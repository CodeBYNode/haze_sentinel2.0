import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estimateHazeOutlook } from './haze-outlook.mjs';
import { createAirQualityHandler } from './air-quality.mjs';
import { WaqiService } from './waqi.mjs';
import vercelHandler from '../../api/haze-outlook.js';

const now = new Date('2026-10-11T00:00:00Z');
const row = (day, avg) => ({ day, avg, min: avg, max: avg });
const reading = (...rows) => ({ station: 'Kuala Lumpur', aqi: 99, observedAt: '2026-10-11T07:00:00+08:00', pollutants: { pm25: 100 }, forecast: { pm25: rows } });
const estimate = (...rows) => estimateHazeOutlook(reading(...rows), now);

describe('daily haze outlook', () => {
  it('estimates relief in a Malaysian calendar-day window', () => {
    const result = estimate(row('2026-10-11', 100), row('2026-10-12', 70));
    assert.equal(result.status, 'estimated'); assert.equal(result.trend, 'easing');
    assert.equal(result.alleviation.expected, true); assert.equal(result.anotherWave.expected, false);
    assert.deepEqual(result.alleviation.timeframe, { date: '2026-10-12', start: '2026-10-12T00:00:00+08:00', end: '2026-10-13T00:00:00+08:00', label: 'Tomorrow, 12 Oct', resolution: 'day', timeZone: 'Asia/Kuala_Lumpur' });
    assert.equal(result.confidence, 'low');
  });
  it('identifies worsening and subsequent relief independently', () => {
    const result = estimate(row('2026-10-11', 100), row('2026-10-12', 140), row('2026-10-13', 100));
    assert.equal(result.trend, 'mixed');
    assert.equal(result.anotherWave.timeframe.date, '2026-10-12');
    assert.equal(result.alleviation.timeframe.date, '2026-10-13');
  });
  it('detects a rebound after initial relief even below the original baseline', () => {
    const result = estimate(row('2026-10-11', 100), row('2026-10-12', 60), row('2026-10-13', 80));
    assert.equal(result.trend, 'mixed'); assert.equal(result.anotherWave.timeframe.date, '2026-10-13');
  });
  it('requires both 20 percent and 10 index points, including a zero baseline', () => {
    assert.equal(estimate(row('2026-10-11', 100), row('2026-10-12', 119)).trend, 'steady');
    assert.equal(estimate(row('2026-10-11', 20), row('2026-10-12', 25)).trend, 'steady');
    assert.equal(estimate(row('2026-10-11', 0), row('2026-10-12', 10)).trend, 'worsening');
  });
  it('uses the same pollutant baseline, never aggregate AQI', () => {
    const result = estimateHazeOutlook({ ...reading(row('2026-10-12', 70)), aqi: 300 }, now);
    assert.equal(result.method.baseline.value, 100); assert.equal(result.method.baseline.source, 'current_observation');
    assert.equal(result.trend, 'easing');
  });
  it('does not treat stale, missing or timestamp-without-zone observations as a baseline', () => {
    for (const observedAt of ['2026-10-10T07:00:00+08:00', '2026-10-11 07:00:00', null, '2026-10-12T00:00:00Z']) {
      const result = estimateHazeOutlook({ ...reading(row('2026-10-12', 70)), observedAt }, now);
      assert.equal(result.status, 'unavailable'); assert.equal(result.reason, 'missing_baseline');
    }
  });
  it('uses today’s model average even when the observation is stale', () => {
    const result = estimateHazeOutlook({ ...reading(row('2026-10-11', 100), row('2026-10-12', 70)), observedAt: null }, now);
    assert.equal(result.trend, 'easing'); assert.equal(result.method.baseline.source, 'today_forecast');
  });
  it('rejects expired forecasts and never returns false reassurance', () => {
    const result = estimate(row('2026-10-03', 120));
    assert.equal(result.status, 'unavailable'); assert.equal(result.reason, 'stale_forecast');
    assert.equal(result.alleviation.expected, null); assert.equal(result.anotherWave.expected, null);
    assert.equal(result.latestForecastDay, '2026-10-03'); assert.match(result.summary, /outdated/);
  });
  it('rejects absent, invalid, non-particulate and far-future data', () => {
    const result = estimateHazeOutlook({ forecast: { pm25: [row('2026-10-12', null), row('2026-10-13', -1), row('2026-02-30', 100), row('2099-10-12', 80)], o3: [row('2026-10-12', 100)] } }, now);
    assert.equal(result.status, 'unavailable'); assert.equal(result.reason, 'missing_future_forecast');
    assert.equal(estimateHazeOutlook({}, now).status, 'unavailable');
  });
  it('falls back to usable PM10 without mixing pollutant scales', () => {
    const result = estimateHazeOutlook({ ...reading(row('2026-10-03', 100)), forecast: { pm25: [row('2026-10-03', 100)], pm10: [row('2026-10-11', 30), row('2026-10-12', 45)] } }, now);
    assert.equal(result.method.pollutant, 'pm10'); assert.equal(result.method.baseline.value, 30); assert.equal(result.trend, 'worsening');
  });
  it('uses Malaysia’s date at UTC midnight boundaries and discloses coverage gaps', () => {
    const result = estimateHazeOutlook(reading(row('2026-10-11', 100), row('2026-10-13', 70)), new Date('2026-10-10T17:00:00Z'));
    assert.equal(result.coverage.from, '2026-10-11'); assert.deepEqual(result.coverage.forecastDays, ['2026-10-13']);
    assert.equal(result.alleviation.timeframe.label, '13 Oct');
  });
});

describe('haze outlook endpoint', () => {
  it('exports a Vercel handler and uses one server-authenticated feed request', async () => {
    assert.equal(typeof vercelHandler, 'function');
    const requests = [];
    const waqi = new WaqiService({ token: 'private-test-token', fetchImpl: async url => {
      requests.push(url);
      return Response.json({ status: 'ok', data: { idx: 5780, aqi: 99, city: { name: 'Kuala Lumpur', geo: [3.14, 101.69] }, time: { iso: '2026-10-11T07:00:00+08:00' }, iaqi: { pm25: { v: 100 } }, forecast: { daily: { pm25: [row('2026-10-11', 100), row('2026-10-12', 70)] } } } });
    } });
    const handler = createAirQualityHandler({ waqi, includeOutlook: true, now: () => now });
    for (const [query, path] of [['', '/feed/here/'], ['?stationId=5780&token=untrusted', '/feed/@5780/'], ['?location=Kuala+Lumpur', '/feed/Kuala%20Lumpur/']]) {
      const response = {};
      await handler({ method: 'GET', url: '/api/haze-outlook' + query }, { writeHead(status, headers) { response.status = status; response.headers = headers; }, end(raw) { response.body = JSON.parse(raw); } });
      assert.equal(response.status, 200); assert.equal(response.headers['cache-control'], 'no-store');
      assert.equal(requests.at(-1).pathname, path); assert.equal(requests.at(-1).searchParams.get('token'), 'private-test-token');
      assert.equal(response.body.reading.aqi, 99); assert.equal(response.body.outlook.trend, 'easing');
      assert.ok(!JSON.stringify(response.body).includes('private-test-token'));
    }
    assert.equal(requests.length, 3);
  });
});
