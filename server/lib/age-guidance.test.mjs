import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAgeGroup, ageActivityGuidance, ageSensitivity } from '../../shared/age-guidance.mjs';
import { assessTomorrow } from './assessment.mjs';
const now = Date.parse('2026-10-11T00:00:00Z');
const reading = { aqi: 99, observedAt: new Date(now).toISOString(), demo: false };
describe('age-based haze guidance', () => {
  it('treats children and older adults with extra caution without assigning overall health', () => {
    for (const group of ['under-18', '65-plus']) {
      const result = ageActivityGuidance(group, Object.freeze(reading), now);
      assert.equal(result.extraCaution, true); assert.match(result.advice, /short and gentle/);
      assert.match(result.outdoorSuggestion, /short, easy walk/); assert.equal(reading.aqi, 99);
    }
    assert.equal(ageSensitivity('18-64').extraCaution, false);
    assert.equal(ageSensitivity('prefer').label, 'Age not disclosed');
  });
  it('does not assume sensitivity for an undisclosed or invalid age and supports legacy age groups', () => {
    for (const value of [undefined, 'prefer', 'unknown', 12]) assert.equal(normalizeAgeGroup(value), 'prefer');
    assert.equal(normalizeAgeGroup('under-5'), 'under-18'); assert.equal(normalizeAgeGroup('5-17'), 'under-18');
    assert.equal(ageActivityGuidance('prefer', reading, now).advice, ageActivityGuidance('18-64', reading, now).advice);
  });
  it('suggests indoor alternatives sooner for sensitive ages, with the same AQI', () => {
    const value = { ...reading, aqi: 120 };
    assert.match(ageActivityGuidance('under-18', value, now).outdoorSuggestion, /indoor/);
    assert.match(ageActivityGuidance('18-64', value, now).advice, /Reduce prolonged/);
    assert.equal(value.aqi, 120);
    for (const age of ['under-18', '18-64', '65-plus', 'prefer']) assert.match(ageActivityGuidance(age, { ...reading, aqi: 170 }, now).advice, /Avoid strenuous outdoor/);
  });
  it('does not give a go-ahead when readings are stale, missing, invalid, future-dated or demo', () => {
    for (const value of [null, { ...reading, aqi: -1 }, { ...reading, observedAt: null }, { ...reading, observedAt: new Date(now - 3 * 3600000).toISOString() }, { ...reading, observedAt: new Date(now + 3600000).toISOString() }, { ...reading, demo: true }]) {
      const result = ageActivityGuidance('under-18', value, now);
      assert.equal(result.readingAvailable, false); assert.match(result.advice, /cannot be assessed/);
    }
  });
  it('applies the new child group to tomorrow assessment without changing observed/forecast indices', () => {
    const value = { ...reading, forecast: { pm25: [{ day: '2026-10-12', avg: 60, min: 40, max: 80 }] } };
    const adult = assessTomorrow(value, { ageGroup: '18-64' }, new Date(now));
    for (const age of ['under-18', '65-plus']) {
      const result = assessTomorrow(value, { ageGroup: age }, new Date(now));
      assert.equal(result.outdoor_guidance, 'extra_caution_for_sensitive_groups');
      assert.equal(result.current_index, adult.current_index); assert.equal(result.forecast_index, adult.forecast_index);
    }
  });
});
