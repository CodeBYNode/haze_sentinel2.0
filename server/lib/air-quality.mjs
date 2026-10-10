import { WaqiService, WaqiError } from './waqi.mjs';
import { estimateHazeOutlook } from './haze-outlook.mjs';

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers,
  });
  res.end(JSON.stringify(body));
};

export function createAirQualityHandler({ waqi = new WaqiService(), includeOutlook = false, now = () => new Date() } = {}) {
  return async (req, res) => {
    if (req.method !== 'GET') {
      return send(res, 405, { error: 'Method not allowed.' }, { allow: 'GET' });
    }

    let q;
    try { q = new URL(req.url || '/', 'http://localhost').searchParams; }
    catch { return send(res, 400, { error: 'Invalid request URL.' }); }

    const stationId = q.get('stationId')?.trim();
    const location = q.get('location')?.trim();
    let where;
    if (stationId) {
      if (!/^\d+$/.test(stationId)) return send(res, 400, { error: 'Invalid station identifier.' });
      where = { stationId };
    } else if (q.has('lat') || q.has('lon')) {
      const lat = q.get('lat'), lon = q.get('lon');
      if (!lat?.trim() || !lon?.trim() || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
        return send(res, 400, { error: 'Provide both latitude and longitude as numbers.' });
      }
      where = { lat: Number(lat), lon: Number(lon) };
    } else {
      // WAQI's `here` uses the requesting server's IP, not the browser's location.
      where = { location: location || 'here' };
    }

    try {
      const reading = await waqi.feed(where);
      return send(res, 200, {
        reading: { ...reading, stationId: reading.stationId || where.stationId },
        ...(includeOutlook ? { outlook: estimateHazeOutlook(reading, now()) } : {}),
      });
    } catch (error) {
      const known = error instanceof WaqiError;
      const status = !known ? 500 : error.code === 'missing_config' ? 503
        : ['not_found', 'unsupported_location'].includes(error.code) ? 404 : 502;
      return send(res, status, {
        error: known ? error.message : 'Air-quality service failed. Please retry.',
        code: known ? error.code : 'internal',
      });
    }
  };
}
