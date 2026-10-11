import { describe, expect, it } from 'vitest';
import { backendHistory, backendProfile, forecastDays, isPlanningRequest, observationState, todayInMalaysia, waqiTone } from './backend';
import { defaultProfile } from '../ui/model';

describe('mobile backend integration boundaries', () => {
  it('sends the selected age group to the backend instead of always preferring not to say', () => {
    for (const ageGroup of ['under-18', '18-64', '65-plus', 'prefer'] as const) expect(backendProfile({ ...defaultProfile, ageGroup }).ageGroup).toBe(ageGroup);
  });
  it('maps optional health choices without sending identity or private notes', () => {
    const result = backendProfile({ ...defaultProfile, conditions: ['Asthma', 'Respiratory sensitivity', 'Heart condition'], notes: 'Private note' }, { name: 'Kuala Lumpur', stationId: '123', coordinates: { lat: 3, lon: 101 }, aqi: null });
    expect(result.health).toEqual(['asthma', 'lung', 'heart']);
    expect(result.ageGroup).toBe('prefer');
    expect(result.other).toBe('');
    expect(result.stationId).toBe('123');
    expect(JSON.stringify(result)).not.toMatch(/Private note|Alex Tan|example.com/);
    expect(backendProfile({ ...defaultProfile, location: 'New location' }, { name: 'Old station', stationId: '1', coordinates: null, aqi: 10 }).stationId).toBeUndefined();
  });

  it('does not use Malaysian demo bands for WAQI sensitive-group readings', () => {
    expect(waqiTone(151)).toBe('moderate');
    expect(waqiTone(150)).toBe('sensitive');
    expect(waqiTone(300)).toBe('severe');
    expect(waqiTone(null)).toBe('');
  });

  it('keeps absent or invalid forecasts empty and never manufactures hourly values', () => {
    expect(forecastDays(null)).toEqual([]);
    expect(forecastDays({ demo: false, forecast: { pm25: [{ day: '2026-10-12', min: 20, avg: 40, max: 60 }, { day: 'bad', min: 0, avg: 10, max: 20 }] } })).toEqual([{ pollutant: 'pm25', day: '2026-10-12', min: 20, avg: 40, max: 60 }]);
  });

  it('keeps replanning local while air-quality questions go to the backend', () => {
    expect(isPlanningRequest('Reschedule my outdoor plans, keeping classes fixed.')).toBe(true);
    expect(isPlanningRequest('When is a better time to go cycling?')).toBe(true);
    expect(isPlanningRequest('May I go jogging now?')).toBe(false);
    expect(isPlanningRequest('Should I exercise indoors?')).toBe(false);
  });

  it('uses Malaysian dates and preserves stale or missing observation status', () => {
    expect(todayInMalaysia(new Date('2026-10-10T17:00:00Z'))).toBe('2026-10-11');
    expect(observationState(null)).toBe('Observation time unavailable');
    expect(observationState('2026-10-10T00:00:00Z', Date.parse('2026-10-10T03:00:00Z'))).toBe('Outdated observation');
  });

  it('excludes demo exchanges, failed replies and another station’s context from live chat', () => {
    expect(backendHistory([
      { role: 'user', text: 'Replan my day', mode: 'demo' },
      { role: 'assistant', text: 'Sample 168', mode: 'demo' },
      { role: 'assistant', text: 'Old city reading', location: 'Old city' },
      { role: 'assistant', text: 'Failed', error: true },
      { role: 'user', text: 'Current air?', location: 'Kuala Lumpur' },
    ], 'Kuala Lumpur')).toEqual([{ role: 'user', content: 'Current air?' }]);
  });
});
