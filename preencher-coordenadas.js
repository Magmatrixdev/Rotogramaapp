// Preenche a coordenada (lat/lng) de TODOS os postos já cadastrados, para o
// Mapa de Postos. Rode UMA vez; depois o app cuida sozinho dos postos novos.
//
// Lê os postos das rotas (/rotogramas) e os avulsos (/postos), pega o link do
// Google Maps de cada um e grava em /postosGeo/{chave do posto}:
//   • link longo  → a coordenada sai direto do texto do link
//   • link curto (maps.app.goo.gl) → segue o link até o endereço completo
//   • sem coordenada (link de pesquisa, sem link) → aparece na lista
//     "sem localização" do mapa (admin) para você corrigir
// Não mexe em coordenadas que você definiu à mão no app (fonte "manual").
//
// Uso (PowerShell, na pasta RotogramaAPP — usa o serviceAccountKey.json):
//   node preencher-coordenadas.js            -> só simula e mostra o resultado
//   node preencher-coordenadas.js --aplicar  -> grava no Firebase
//   node preencher-coordenadas.js --aplicar --refazer  -> refaz também os já preenchidos

const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const sa = require('./serviceAccountKey.json');

const APLICAR = process.argv.includes('--aplicar');
const REFAZER = process.argv.includes('--refazer');

initializeApp({ credential: cert(sa), databaseURL: 'https://rotogramas-confianca-default-rtdb.firebaseio.com' });
const db = getDatabase();

// ── mesma lógica do app (app-postos.js) e da Cloud Function (helpers/geo.ts) ──
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const geoKey = nome => norm(nome).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 120) || 'sem_nome';
const geoOk = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
const N = '(-?\\d{1,3}(?:\\.\\d+)?)';
const URL_PATS = [
  new RegExp('!3d' + N + '!4d' + N),
  new RegExp('[?&](?:q|query|ll|sll|destination|daddr|center)=(?:loc:)?' + N + '\\s*,\\s*' + N),
  new RegExp('/place/' + N + '\\s*,\\s*' + N),
  new RegExp('@' + N + ',' + N),
];
const BODY_PATS = [new RegExp('!3d' + N + '!4d' + N), new RegExp('markers=' + N + '(?:%2C|,)' + N)];
const GOOGLE_HOST = /(^|\.)(google\.com(\.[a-z]{2})?|google\.[a-z]{2}|goo\.gl|g\.co)$/i;

function match(text, pats) {
  for (const re of pats) {
    const m = text.match(re);
    if (m) { const lat = parseFloat(m[1]), lng = parseFloat(m[2]); if (geoOk(lat, lng)) return { lat, lng }; }
  }
  return null;
}
function parseCoords(link) {
  let s = String(link || '').trim();
  if (!s) return null;
  try { s = decodeURIComponent(s); } catch (e) { /* mantém */ }
  const pats = /\/maps\/search\//i.test(s) ? URL_PATS.filter(re => !re.source.startsWith('@')) : URL_PATS;
  return match(s, pats);
}
function hostPermitido(url) {
  try { const u = new URL(url); return /^https?:$/.test(u.protocol) && GOOGLE_HOST.test(u.hostname); } catch (e) { return false; }
}
async function resolveLink(link) {
  const direto = parseCoords(link);
  if (direto) return direto;
  let url = String(link || '').trim();
  for (let i = 0; i < 6; i++) {
    if (!hostPermitido(url)) return null;
    const res = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0', 'Accept-Language': 'pt-BR,pt;q=0.9' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return null;
      url = new URL(loc, url).toString();
      const c = parseCoords(url);
      if (c) return c;
      continue;
    }
    if (!res.ok) return null;
    return match((await res.text()).slice(0, 600000), BODY_PATS);
  }
  return null;
}

(async () => {
  const [rotSnap, posSnap, geoSnap] = await Promise.all([
    db.ref('rotogramas').once('value'), db.ref('postos').once('value'), db.ref('postosGeo').once('value'),
  ]);
  const rotas = rotSnap.val() || [];
  const avulsos = posSnap.val() || {};
  const geo = geoSnap.val() || {};

  // junta postos (dedup por nome — avulso sobrescreve o da rota, igual ao app)
  const postos = {};
  (Array.isArray(rotas) ? rotas : Object.values(rotas)).forEach(r => {
    ((r && r.paradas) || []).forEach(p => {
      if (!p || p.tipo === 'origem' || p.tipo === 'destino') return;
      [p, p.alternativa].filter(Boolean).forEach(x => {
        const k = norm(x.nome);
        if (k && !postos[k]) postos[k] = { nome: x.nome, cidade: x.cidade || '', link: x.link || '' };
      });
    });
  });
  Object.values(avulsos).forEach(p => {
    const k = norm(p && p.nome);
    if (k) postos[k] = { ...(postos[k] || {}), nome: p.nome, cidade: p.cidade || '', link: p.link || (postos[k] && postos[k].link) || '' };
  });

  const lista = Object.values(postos).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  console.log(`${lista.length} postos encontrados${APLICAR ? '' : ' (SIMULAÇÃO — nada será gravado; use --aplicar)'}\n`);

  const res = { ok: 0, ja: 0, manual: 0, sem: [] };
  for (const p of lista) {
    const key = geoKey(p.nome);
    const g = geo[key];
    if (g && g.fonte === 'manual') { res.manual++; continue; }
    if (!REFAZER && g && !g.falhou && geoOk(g.lat, g.lng) && g.link === p.link) { res.ja++; continue; }
    if (!p.link) { res.sem.push(`${p.nome} (${p.cidade}) — sem link`); continue; }
    let c = null;
    try { c = await resolveLink(p.link); } catch (e) { /* conta como sem coordenada */ }
    if (c) {
      res.ok++;
      console.log(`  ✔ ${p.nome} → ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`);
      if (APLICAR) await db.ref('postosGeo/' + key).set({ nome: p.nome, lat: c.lat, lng: c.lng, link: p.link.slice(0, 500), fonte: 'link', data: Date.now() });
    } else {
      res.sem.push(`${p.nome} (${p.cidade}) — link sem coordenada`);
      if (APLICAR) await db.ref('postosGeo/' + key).set({ nome: p.nome, link: p.link.slice(0, 500), falhou: true, data: Date.now() });
    }
    await new Promise(r => setTimeout(r, 250)); // não martelar o Google
  }

  console.log(`\nResumo: ${res.ok} com coordenada${APLICAR ? ' gravada' : ''} · ${res.ja} já estavam preenchidos · ${res.manual} definidos à mão (mantidos) · ${res.sem.length} sem localização`);
  if (res.sem.length) console.log('\nSem localização (corrija pelo mapa, botão "sem localização"):\n  - ' + res.sem.join('\n  - '));
  process.exit(0);
})().catch(e => { console.error('Erro:', e.message || e); process.exit(1); });
