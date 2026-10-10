import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { assessEventForecast, assessSpendings, compareSpendingOptions, validateSpendingEvents, validateSpendingCalendar } from './spendings.mjs';
import { handleSpendings } from '../spendings.mjs';

const now = new Date('2026-10-11T04:00:00Z');
const booking = overrides => ({ total: 120, deposit: 50, refund: 'nonrefundable', changeFee: 15, indoorCost: 90, relocationFee: 20, cancelFee: 0, cancelBalance: 'waived', reference: '', terms: '', deadline: '', forecastLocation: 'Kuala Lumpur', forecastStationId: '', indoorConfirmed: true, currentIndoorConfirmed: false, alternativeConfirmed: true, alternativeDate: '2026-10-14', alternativeTime: '18:00', depositTransfers: false, rescheduleDepositTransfers: true, operatingCost: 0, expectedIncome: 0, ...overrides });
const event = overrides => ({ id: 'futsal', date: '2026-10-12', time: '18:00', duration: 120, location: 'Outdoor futsal venue', outdoor: true, fixed: false, kind: 'other', booking: booking(), ...overrides });
const row = (day, max) => ({ day, min: Math.min(20, max), avg: Math.min(40, max), max });
const reading = overrides => ({ station: 'KL station', source: 'WAQI', stationUrl: 'https://aqicn.org/city/kuala-lumpur/', observedAt: now.toISOString(), aqi: 42, forecast: { pm25: [row('2026-10-12', 180), row('2026-10-13', 120), row('2026-10-14', 40)] }, ...overrides });
const quote = async (e = event(), feed = async () => reading(), calendar) => (await assessSpendings([e], { now, feed, calendar })).assessments[0];

describe('Spendings validation', () => {
  it('accepts valid bookings and zero amounts without treating them as missing', () => {
    const e = event({ booking: booking({ total: 0, deposit: 0, changeFee: 0 }) });
    assert.equal(validateSpendingEvents({ events: [e] })[0].booking.total, 0);
  });
  it('rejects invalid money, duplicate IDs, impossible dates and oversized requests', () => {
    for (const value of [-1, NaN, '120', 0.001, 10000001, null]) assert.throws(() => validateSpendingEvents({ events: [event({ booking: booking({ total: value }) })] }));
    assert.throws(() => validateSpendingEvents({ events: [event({ booking: booking({ deposit: 121 }) })] }), /deposit/);
    assert.throws(() => validateSpendingEvents({ events: [event(), event()] }), /unique/);
    assert.throws(() => validateSpendingEvents({ events: [event({ date: '2026-02-30' })] }), /valid date/);
    assert.throws(() => validateSpendingEvents({ events: [event({ time: '25:00' })] }));
    assert.throws(() => validateSpendingEvents({ events: Array(31).fill(event()) }), /30/);
    assert.throws(() => validateSpendingEvents({ events: [event({ booking: booking({ alternativeTime: '' }) })] }), /alternative/);
  });
  it('validates the calendar and avoids comparing a booking with itself', () => {
    assert.deepEqual(validateSpendingCalendar([event()], ['futsal']), []);
    assert.throws(() => validateSpendingCalendar([{ id: 'x', date: 'bad' }]), /Calendar/);
    assert.throws(() => validateSpendingCalendar(Array(301).fill({})), /300/);
  });
});

describe('Event forecast coverage', () => {
  it('uses the event date instead of current AQI and leaves issue time unavailable', () => {
    const result = assessEventForecast(event(), reading(), now);
    assert.equal(result.risk, 'high'); assert.equal(result.index, 180);
    assert.equal(result.forecastUpdatedAt, null);
    assert.equal(result.checkedAt, now.toISOString());
    assert.match(result.reason, /exact hour/);
  });
  it('does not substitute another day, UV data, or stale / future observations', () => {
    const fixtures = [reading({ forecast: { pm25: [row('2026-10-10', 10)] } }), reading({ forecast: { uvi: [row('2026-10-12', 10)] } }), reading({ observedAt: '2026-10-10T00:00:00Z' }), reading({ observedAt: '2026-10-12T00:00:00Z' }), reading({ observedAt: null }), reading({ forecast: { pm25: [row('2026-10-12', null)] } }), reading({ forecast: { pm25: [{ day: '2026-10-12', min: 60, avg: 40, max: 50 }] } })];
    for (const data of fixtures) assert.equal(assessEventForecast(event(), data, now).risk, 'unknown');
  });
  it('covers every day of a cross-midnight activity and excludes the end boundary', () => {
    const e = event({ time: '23:00' });
    assert.deepEqual(assessEventForecast(e, reading(), now).period, ['2026-10-12', '2026-10-13']);
    assert.equal(assessEventForecast(e, reading({ forecast: { pm25: [row('2026-10-12', 20)] } }), now).risk, 'unknown');
    assert.deepEqual(assessEventForecast(event({ time: '22:00' }), reading(), now).period, ['2026-10-12']);
  });
});

describe('Cash costs and feasible options', () => {
  it('calculates the RM120 / RM50 example, counts deposits once and keeps the event scheduled', async () => {
    const e = event(); const original = structuredClone(e); const result = await quote(e);
    assert.deepEqual(result.options.map(o => o.cost), [120, 160, 135, 50]);
    assert.equal(result.cheapest, 'cancel'); assert.equal(result.status, 'scheduled');
    assert.equal(result.options[0].feasible, false);
    assert.deepEqual(e, original);
  });
  it('highlights an indoor option when outdoor proceeding is cheaper but unsuitable', async () => {
    const result = await quote(event({ booking: booking({ cancelFee: 200, indoorCost: 10, relocationFee: 0, depositTransfers: true, alternativeConfirmed: false }) }));
    assert.equal(result.options[1].cost, 250); // transferred deposit is not silently refunded
    assert.equal(result.options[0].cost, 120);
    assert.equal(result.options[0].feasible, false);
    assert.equal(result.cheapest, 'relocate');
  });
  it('handles refunds and balances that remain payable', async () => {
    const refunded = await quote(event({ booking: booking({ refund: 'refundable' }) }));
    assert.equal(refunded.options[3].cost, 0); assert.equal(refunded.options[1].cost, 110);
    const due = await quote(event({ booking: booking({ cancelBalance: 'due', cancelFee: 10 }) }));
    assert.equal(due.options[3].cost, 130);
    const full = await quote(event({ booking: booking({ deposit: 120, cancelBalance: 'unknown' }) }));
    assert.equal(full.options[3].cost, 120);
  });
  it('recommends rescheduling over cheaper unsafe proceeding when its new forecast is lower risk', async () => {
    const result = await quote(event({ booking: booking({ cancelFee: 500 }) }));
    assert.equal(result.options[0].cost, 120); assert.equal(result.options[0].feasible, false);
    assert.equal(result.options[2].cost, 135); assert.equal(result.options[2].feasible, true);
    assert.equal(result.cheapest, 'reschedule');
  });
  it('does not price unknown fees as zero or assume a balance is waived', async () => {
    const result = await quote(event({ booking: booking({ changeFee: null, cancelFee: null, cancelBalance: 'unknown', indoorCost: null }) }));
    assert.deepEqual(result.options.map(o => o.cost), [120, null, null, null]);
    assert.equal(result.cheapest, null);
  });
  it('honors expired deadlines and loss of a deposit when changing time', async () => {
    const expired = await quote(event({ booking: booking({ deadline: '2026-10-11T11:00' }) }));
    assert.equal(expired.cheapest, null); assert.deepEqual(expired.options.slice(1).map(o => o.cost), [null, null, null]);
    const lost = await quote(event({ booking: booking({ rescheduleDepositTransfers: false }) }));
    assert.equal(lost.options[2].cost, 185);
  });
  it('checks fixed commitments, alternate forecast coverage, past times and calendar conflicts', async () => {
    assert.equal((await quote(event({ fixed: true }))).options[2].feasible, false);
    assert.equal((await quote(event({ booking: booking({ alternativeDate: '2026-10-15' }) }))).options[2].feasible, false);
    assert.equal((await quote(event({ booking: booking({ alternativeDate: '2026-10-10' }) }))).options[2].feasible, false);
    const e = event();
    const result = await quote(e, undefined, [e, { id: 'lecture', date: '2026-10-14', time: '19:00', duration: 60 }]);
    assert.equal(result.options[2].feasible, false); assert.match(result.options[2].reason, /overlaps/);
    const same = await quote(event({ booking: booking({ alternativeDate: '2026-10-12', alternativeTime: '18:00' }) }));
    assert.equal(same.options[2].feasible, false);
  });
  it('keeps cash operating costs and forgone income separate and rounds at cents', async () => {
    const result = await quote(event({ booking: booking({ total: 10.10, deposit: .10, operatingCost: .20, expectedIncome: 300 }) }));
    assert.equal(result.options[0].cost, 10.30);
    assert.equal(result.options[3].cost, .10);
    assert.equal(result.options[3].incomeAtRisk, 300);
  });
  it('requires explicit indoor air / exposure confirmation for proceeding indoors', () => {
    const e = event({ outdoor: false });
    const forecast = assessEventForecast(e, reading(), now);
    assert.equal(compareSpendingOptions(e, forecast, null, now)[0].feasible, false);
    e.booking.currentIndoorConfirmed = true;
    assert.equal(compareSpendingOptions(e, forecast, null, now)[0].feasible, true);
  });
});

describe('Assessment service', () => {
  it('uses event locations independently and only coalesces within one request', async () => {
    const calls = [];
    const feed = async where => { calls.push(where); return reading(); };
    const events = [event(), event({ id: 'second' }), event({ id: 'pj', booking: booking({ forecastLocation: 'Petaling Jaya' }) }), event({ id: 'station', booking: booking({ forecastStationId: '123' }) })];
    await assessSpendings(events, { feed, now });
    assert.deepEqual(calls, [{ location: 'Kuala Lumpur' }, { location: 'Petaling Jaya' }, { stationId: '123' }]);
    await assessSpendings(events, { feed, now }); assert.equal(calls.length, 6);
  });
  it('excludes unknown and distant / past events from seven-day exposure without losing them', async () => {
    const events = [event(), event({ id: 'distant', date: '2026-11-12' }), event({ id: 'past', date: '2026-10-09' }), event({ id: 'missing', booking: booking({ forecastLocation: 'Missing' }) })];
    const result = await assessSpendings(events, { feed: async where => { if (where.location === 'Missing') throw new Error('Quota reached'); return reading(); }, now });
    assert.equal(result.assessments.length, 4);
    assert.equal(result.summary.bookingValueAtRisk, 120);
    assert.equal(result.summary.depositsAtRisk, 50);
    assert.equal(result.summary.unknownCount, 1);
    assert.equal(result.assessments[3].forecast.risk, 'unknown');
    assert.match(result.assessments[3].forecast.reason, /Quota/);
  });
});

describe('Spendings HTTP endpoint', () => {
  it('validates POST bodies, sends only location to the provider and sets no-store', async () => {
    const calls = [];
    const server = createServer(async (req, res) => {
      const json = (r, status, body) => { r.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); r.end(JSON.stringify(body)); };
      const jsonBody = async r => { let raw = ''; for await (const part of r) raw += part; return JSON.parse(raw); };
      await handleSpendings(req, res, { json, jsonBody, waqi: { feed: async where => { calls.push(where); return reading({ observedAt: new Date().toISOString() }); } } });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = `http://127.0.0.1:${server.address().port}`;
      const invalid = await fetch(address, { method: 'POST', body: '{bad' }); assert.equal(invalid.status, 400);
      const e = event({ date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), booking: booking({ reference: 'private-ref', terms: 'private-terms', alternativeConfirmed: false }) });
      const response = await fetch(address, { method: 'POST', body: JSON.stringify({ events: [e], calendar: [e] }) });
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
      const result = await response.json(); assert.equal(result.assessments[0].status, 'scheduled');
      assert.deepEqual(calls, [{ location: 'Kuala Lumpur' }]);
      assert.equal(JSON.stringify(result).includes('private'), false);
      const empty = await fetch(address, { method: 'POST', body: JSON.stringify({ events: [], calendar: [] }) });
      assert.equal(empty.status, 200);
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
});
