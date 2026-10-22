// Recomprime as fotos antigas dos postos no Firebase Storage (pasta postos/).
//
// Mantém o MESMO caminho e o MESMO token de download de cada foto, então os
// links gravados no banco continuam funcionando — não altera nada no Database.
// Antes de sobrescrever, salva o original em ./backup-fotos/.
//
// Uso (PowerShell, na pasta RotogramaAPP):
//   npm install sharp
//   node recomprimir-fotos.js            -> só simula e mostra o ganho
//   node recomprimir-fotos.js --aplicar  -> recomprime de verdade

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const sa = require('./serviceAccountKey.json');

const BUCKET = 'rotogramas-confianca.firebasestorage.app';
const MAX_PX = 1600;           // lado maior
const QUALIDADE = 80;          // JPEG
const MIN_BYTES = 400 * 1024;  // só mexe em fotos acima de 400 KB
const CACHE = 'public,max-age=31536000';
const APLICAR = process.argv.includes('--aplicar');
const BACKUP_DIR = path.join(__dirname, 'backup-fotos');

initializeApp({ credential: cert(sa), storageBucket: BUCKET });
const bucket = getStorage().bucket();

const kb = n => (n / 1024).toFixed(0) + ' KB';

(async () => {
  console.log(APLICAR ? '>>> MODO APLICAR — as fotos serão sobrescritas\n' : '>>> SIMULAÇÃO — nada será alterado (use --aplicar)\n');
  const [files] = await bucket.getFiles({ prefix: 'postos/' });
  let total = 0, antes = 0, depois = 0, mexidas = 0, puladas = 0, erros = 0;

  for (const file of files) {
    if (file.name.endsWith('/')) continue;
    total++;
    try {
      const [meta] = await file.getMetadata();
      const tam = Number(meta.size || 0);
      const tipo = meta.contentType || '';
      if (!tipo.startsWith('image/') || /gif|svg/.test(tipo) || tam < MIN_BYTES) {
        puladas++;
        // Mesmo pequena, garante o cache longo se ainda não tiver
        if (APLICAR && meta.cacheControl !== CACHE) await file.setMetadata({ cacheControl: CACHE });
        continue;
      }

      const [orig] = await file.download();
      const novo = await sharp(orig)
        .rotate() // aplica a orientação do EXIF (foto de celular deitada)
        .resize({ width: MAX_PX, height: MAX_PX, fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: QUALIDADE, mozjpeg: true })
        .toBuffer();

      if (novo.length >= tam) { puladas++; continue; }

      console.log(`${file.name}: ${kb(tam)} -> ${kb(novo.length)}`);
      antes += tam; depois += novo.length; mexidas++;

      if (APLICAR) {
        const destino = path.join(BACKUP_DIR, file.name);
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        fs.writeFileSync(destino, orig);

        const custom = meta.metadata || {};
        await file.save(novo, {
          resumable: false,
          metadata: {
            contentType: 'image/jpeg',
            cacheControl: CACHE,
            // Mantém o token: as URLs ...?alt=media&token=XXX salvas no banco seguem válidas
            metadata: { ...custom, firebaseStorageDownloadTokens: custom.firebaseStorageDownloadTokens },
          },
        });
      }
    } catch (e) {
      erros++;
      console.error(`ERRO em ${file.name}: ${e.message}`);
    }
  }

  console.log('\n────────────────────────────');
  console.log(`Arquivos em postos/: ${total}`);
  console.log(`Recomprimidas: ${mexidas} | Já pequenas/puladas: ${puladas} | Erros: ${erros}`);
  if (mexidas) console.log(`Tamanho: ${(antes / 1048576).toFixed(1)} MB -> ${(depois / 1048576).toFixed(1)} MB (${Math.round(100 - depois / antes * 100)}% menor)`);
  if (APLICAR && mexidas) console.log(`Originais salvos em: ${BACKUP_DIR}`);
  process.exit(erros ? 1 : 0);
})().catch(e => { console.error('Falhou:', e.message); process.exit(1); });
