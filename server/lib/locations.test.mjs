import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createLocationSearchHandler } from './locations.mjs';
import { WaqiService } from './waqi.mjs';
import vercelHandler from '../../api/locations/search.js';

async function invoke(handler, query = 'Kuala+Lumpur', method = 'GET') {
  const response = {};
  await handler({ url: '/api/locations/search?q=' + query, method }, {
    writeHead(status, headers) { response.status = status; response.headers = headers; },
    end(raw) { response.body = JSON.parse(raw); },
  });
  return response;
}

describe('WAQI station discovery', () => {
  it('exposes a Vercel handler and reads the actual WAQI data array with numeric IDs', async () => {
    assert.equal(typeof vercelHandler, 'function');
    let upstream;
    const waqi = new WaqiService({ token: 'private-test-token', fetchImpl: async url => {
      upstream = url;
      return Response.json({ status: 'ok', data: [
        { uid: 5780, station: { name: 'Kuala Lumpur', geo: [3.139003, 101.686855] }, aqi: '0' },
        { uid: 2626, station: { name: 'Cheras, Kuala Lumpur', geo: [3.106236, 101.717917] }, aqi: '-' },
        { uid: 1, station: { name: 'Outside Malaysia', geo: [51.5, -0.1] }, aqi: '12' },
        { uid: 'invalid', station: { name: 'Malformed station', geo: [3.1, 101.7] } },
        null,
      ] });
    } });
    const response = await invoke(createLocationSearchHandler({ waqi }));
    assert.equal(response.status, 200);
    assert.equal(upstream.pathname, '/search/');
    assert.equal(upstream.searchParams.get('keyword'), 'Kuala Lumpur');
    assert.equal(upstream.searchParams.get('token'), 'private-test-token');
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.deepEqual(response.body.locations.map(s => [s.stationId, s.aqi]), [['5780', 0], ['2626', null]]);
    assert.ok(!JSON.stringify(response.body).includes('private-test-token'));
  });

  it('keeps an empty result distinct from a malformed upstream response', async () => {
    for (const [data, status] of [[[], 200], [{ data: [] }, 502]]) {
      const waqi = new WaqiService({ token: 'test-token', fetchImpl: async () => Response.json({ status: 'ok', data }) });
      const response = await invoke(createLocationSearchHandler({ waqi }));
      assert.equal(response.status, status);
      if (status === 200) assert.deepEqual(response.body.locations, []);
      else assert.equal(response.body.code, 'malformed');
    }
  });

  it('avoids provider calls for short queries, excessive queries and unsupported methods', async () => {
    let calls = 0;
    const waqi = new WaqiService({ token: 'test-token', fetchImpl: async () => { calls++; throw new Error('Unexpected request'); } });
    const handler = createLocationSearchHandler({ waqi });
    assert.deepEqual((await invoke(handler, 'K')).body.locations, []);
    assert.equal((await invoke(handler, 'x'.repeat(121))).status, 400);
    const response = await invoke(handler, 'Kuala', 'POST');
    assert.equal(response.status, 405);
    assert.equal(response.headers.allow, 'GET');
    assert.equal(calls, 0);
  });

  it('reports missing configuration and sanitizes unexpected errors', async () => {
    const missing = await invoke(createLocationSearchHandler({ waqi: new WaqiService({ token: '' }) }));
    assert.equal(missing.status, 503);
    assert.equal(missing.body.code, 'missing_config');
    const failed = await invoke(createLocationSearchHandler({ waqi: { search: async () => { throw new Error('private detail'); } } }));
    assert.equal(failed.status, 500);
    assert.ok(!JSON.stringify(failed.body).includes('private detail'));
  });
});
