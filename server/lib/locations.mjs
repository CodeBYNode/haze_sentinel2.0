import { WaqiService, WaqiError } from './waqi.mjs';

export function createLocationSearchHandler({ waqi = new WaqiService() } = {}) {
  return async (req, res) => {
    const send = (status, body, headers = {}) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers });
      res.end(JSON.stringify(body));
    };
    if (req.method !== 'GET') return send(405, { error: 'Method not allowed.' }, { allow: 'GET' });
    let query;
    try { query = new URL(req.url || '/', 'http://localhost').searchParams.get('q') || ''; }
    catch { return send(400, { error: 'Invalid request URL.' }); }
    if (query.length > 120) return send(400, { error: 'Search must be under 121 characters.' });
    try {
      return send(200, { locations: await waqi.search(query) });
    } catch (error) {
      const known = error instanceof WaqiError;
      return send(!known ? 500 : error.code === 'missing_config' ? 503 : 502, {
        error: known ? error.message : 'Station search failed. Please retry.',
        code: known ? error.code : 'internal',
      });
    }
  };
}
