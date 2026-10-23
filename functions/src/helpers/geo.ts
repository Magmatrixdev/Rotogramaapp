// Leitura de coordenadas a partir de links do Google Maps.
// Link longo: a coordenada já vem no texto. Link curto (maps.app.goo.gl):
// segue os redirecionamentos (só para domínios do Google) até chegar no link
// longo; se nem assim aparecer, procura a coordenada no HTML da página final.

export interface LatLng { lat: number; lng: number; }

// Mesma chave do app (simPostoKey / _geoKey): nome sem acento, minúsculo, _
export function geoKey(nome: string): string {
  return String(nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 120) || 'sem_nome';
}

export function geoOk(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

const N = '(-?\\d{1,3}(?:\\.\\d+)?)';
const URL_PATS = [
  new RegExp('!3d' + N + '!4d' + N),
  new RegExp('[?&](?:q|query|ll|sll|destination|daddr|center)=(?:loc:)?' + N + '\\s*,\\s*' + N),
  new RegExp('/place/' + N + '\\s*,\\s*' + N),
  new RegExp('@' + N + ',' + N + ',(\\d+(?:\\.\\d+)?)(z|m)'),
];
// Padrões que aparecem dentro do HTML da página do Maps
// (só os que marcam o PONTO do lugar — "center"/"@" no HTML podem ser apenas o
// centro da tela numa pesquisa, e um pino no lugar errado é pior que nenhum)
const BODY_PATS = [
  new RegExp('!3d' + N + '!4d' + N),
  new RegExp('markers=' + N + '(?:%2C|,)' + N),
];

function match(text: string, pats: RegExp[]): LatLng | null {
  for (const re of pats) {
    const m = text.match(re);
    // "@lat,lng,8z" é só a vista do mapa (link sem lugar marcado) — vale apenas com zoom de rua
    if (m && m[4] && (m[4] === 'z' ? parseFloat(m[3]) < 14 : parseFloat(m[3]) > 3000)) continue;
    if (m) {
      const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
      if (geoOk(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

export function parseCoords(link: string): LatLng | null {
  let s = String(link || '').trim();
  if (!s) return null;
  try { s = decodeURIComponent(s); } catch { /* mantém como veio */ }
  // Link de pesquisa (/maps/search/): o "@" é só o centro da tela, não o posto
  const pats = /\/maps\/search\//i.test(s) ? URL_PATS.filter(re => !re.source.startsWith('@')) : URL_PATS;
  return match(s, pats) || match(s, [new RegExp('^' + N + '\\s*[,;]\\s*' + N + '$')]);
}

const GOOGLE_HOST = /(^|\.)(google\.com(\.[a-z]{2})?|google\.[a-z]{2}|goo\.gl|g\.co)$/i;

export function hostPermitido(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === 'https:' || u.protocol === 'http:') && GOOGLE_HOST.test(u.hostname);
  } catch { return false; }
}

// Segue até 6 redirecionamentos e devolve a coordenada (ou null)
export async function resolveLink(link: string): Promise<LatLng | null> {
  const direto = parseCoords(link);
  if (direto) return direto;
  let url = String(link || '').trim();
  for (let i = 0; i < 6; i++) {
    if (!hostPermitido(url)) return null;
    const res = await fetch(url, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
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
    const body = (await res.text()).slice(0, 600000);
    return match(body, BODY_PATS);
  }
  return null;
}
