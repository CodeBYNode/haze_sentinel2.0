import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createAirQualityHandler } from './air-quality.mjs';
import { WaqiService } from './waqi.mjs';
import vercelHandler from '../../api/air-quality.js';

const providerData = {
  idx: 5780, aqi: 0, city: { name: 'Kuala Lumpur', geo: [3.139003, 101.686855], url: 'https://aqicn.org/city/kuala-lumpur/' },
  time: { iso: '2026-10-11T06:00:00+08:00', tz: '+08:00' },
  iaqi: { pm25: { v: 0 }, pm10: { v: 12 } },
  attributions: [{ name: 'Provider', url: 'https://example.com' }],
};

async function invoke(handler, url = '/api/air-quality', method = 'GET') {
  const response = {};
  await handler({ url, method }, {
    writeHead(status, headers) { response.status = status; response.headers = headers; },
    end(raw) { response.body = JSON.parse(raw); },
  });
  return response;
}

function setup(fetchImpl, token = 'private-test-token') {
  const requests = [];
  const waqi = new WaqiService({ token, fetchImpl: async (url, init) => {
    requests.push({ url, init });
    const selectedId = url.pathname.match(/^\/feed\/@(\d+)\//)?.[1];
    return fetchImpl ? fetchImpl(url, init) : Response.json({ status: 'ok', data: { ...providerData, idx: selectedId ? Number(selectedId) : providerData.idx } });
  } });
  return { handler: createAirQualityHandler({ waqi }), requests };
}

describe('air-quality serverless endpoint', () => {
  it('exports a Vercel handler without starting a listening server', () => {
    assert.equal(typeof vercelHandler, 'function');
  });

  it('uses the here feed by default and returns WAQI’s resolved station ID without a token', async () => {
    const { handler, requests } = setup();
    const response = await invoke(handler);
    assert.equal(response.status, 200);
    assert.equal(requests[0].url.pathname, '/feed/here/');
    assert.equal(requests[0].url.searchParams.get('token'), 'private-test-token');
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.match(response.headers['content-type'], /application\/json/);
    assert.equal(response.body.reading.stationId, '5780');
    assert.equal(response.body.reading.station, providerData.city.name);
    assert.equal(response.body.reading.aqi, 0);
    assert.equal(response.body.reading.category, 'Good');
    assert.equal(response.body.reading.pollutants.pm25, 0);
    assert.equal(response.body.reading.observedAt, providerData.time.iso);
    assert.deepEqual(response.body.reading.attributions, providerData.attributions);
    assert.equal(response.body.reading.demo, false);
    assert.ok(!JSON.stringify(response.body).includes('private-test-token'));
  });

  it('honors a selected station and ignores client-supplied provider tokens', async () => {
    const { handler, requests } = setup();
    const response = await invoke(handler, '/api/air-quality?stationId=42&location=Kuala+Lumpur&token=untrusted');
    assert.equal(response.status, 200);
    assert.equal(requests[0].url.pathname, '/feed/@42/');
    assert.equal(requests[0].url.searchParams.get('token'), 'private-test-token');
    assert.equal(response.body.reading.stationId, '42');
  });

  it('uses explicit city names rather than the server IP for city lookups', async () => {
    const { handler, requests } = setup();
    assert.equal((await invoke(handler, '/api/air-quality?location=Kuala+Lumpur')).status, 200);
    assert.equal(requests[0].url.pathname, '/feed/Kuala%20Lumpur/');
  });

  it('accepts an explicit here lookup', async () => {
    const { handler, requests } = setup();
    assert.equal((await invoke(handler, '/api/air-quality?location=here')).status, 200);
    assert.equal(requests[0].url.pathname, '/feed/here/');
  });

  it('uses device coordinates before the profile city', async () => {
    const { handler, requests } = setup();
    assert.equal((await invoke(handler, '/api/air-quality?lat=3.14&lon=101.69&location=Shah+Alam')).status, 200);
    assert.equal(requests[0].url.pathname, '/feed/geo:3.14;101.69/');
  });

  it('rejects invalid selectors and unsupported methods before contacting WAQI', async () => {
    const { handler, requests } = setup();
    for (const query of ['stationId=invalid', 'lat=3.14', 'lat=&lon=101.69', 'lat=NaN&lon=101.69']) {
      assert.equal((await invoke(handler, '/api/air-quality?' + query)).status, 400);
    }
    const response = await invoke(handler, '/api/air-quality', 'POST');
    assert.equal(response.status, 405);
    assert.equal(response.headers.allow, 'GET');
    assert.equal(requests.length, 0);
  });

  it('reports a missing server token without returning invented readings', async () => {
    const { handler, requests } = setup(undefined, '');
    const response = await invoke(handler);
    assert.equal(response.status, 503);
    assert.equal(response.body.code, 'missing_config');
    assert.equal(response.body.reading, undefined);
    assert.equal(requests.length, 0);
  });

  it('sanitizes provider errors and keeps network and malformed responses unavailable', async () => {
    for (const fetchImpl of [
      async () => { throw new Error('private-test-token'); },
      async () => new Response('not JSON'),
      async () => Response.json({ status: 'error', data: 'Invalid key: private-test-token' }),
      async () => Response.json({ status: 'ok', data: {} }),
    ]) {
      const response = await invoke(setup(fetchImpl).handler);
      assert.equal(response.status, 502);
      assert.equal(response.body.reading, undefined);
      assert.ok(!JSON.stringify(response.body).includes('private-test-token'));
    }
  });

  it('does not substitute a station outside Malaysia', async () => {
    const { handler, requests } = setup();
    const response = await invoke(handler, '/api/air-quality?lat=51.5&lon=-0.1');
    assert.equal(response.status, 404);
    assert.equal(response.body.code, 'unsupported_location');
    assert.equal(requests.length, 0);
  });

  it('does not expose unexpected internal errors', async () => {
    const handler = createAirQualityHandler({ waqi: { feed: async () => { throw new Error('private internal detail'); } } });
    const response = await invoke(handler);
    assert.equal(response.status, 500);
    assert.equal(response.body.code, 'internal');
    assert.ok(!JSON.stringify(response.body).includes('private internal detail'));
  });
});
