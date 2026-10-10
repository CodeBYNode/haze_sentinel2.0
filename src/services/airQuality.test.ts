import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCurrentAir, searchStations } from './airQuality';
import type { Profile } from '../core/types';

const profile: Profile = { ageGroup: 'prefer', health: [], other: '', location: 'Kuala Lumpur', language: 'en', guest: true };
afterEach(() => vi.unstubAllGlobals());

describe('air-quality API client', () => {
  it('preserves source values and timestamp, and queries the chosen station', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ reading: { aqi: 0, category: 'Good', indexName: 'WAQI AQI scale', observedAt: '2026-10-11T00:00:00+08:00', station: 'Station A', pollutants: { pm25: 0 }, forecast: null, attributions: [], source: 'WAQI' } })));
    vi.stubGlobal('fetch', fetchMock);
    const result = await getCurrentAir({ ...profile, stationId: '42' });
    expect(fetchMock.mock.calls[0]).toEqual(['/api/air-quality?stationId=42', { signal: undefined, cache: 'no-store' }]);
    expect(result).toMatchObject({ aqi: 0, scale: 'WAQI AQI scale', observedAt: '2026-10-11T00:00:00+08:00', pollutants: { pm25: 0 }, forecast: null, demo: false });
    expect(result.pm10).toBeUndefined();
  });

  it('normalizes numeric station identifiers for subsequent backend requests', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ locations: [{ name: 'Station A', stationId: 42, coordinates: { lat: 3, lon: 101 }, aqi: null }] }))));
    expect((await searchStations('Kuala Lumpur'))[0].stationId).toBe('42');
  });

  it('surfaces backend failures rather than substituting demo measurements', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Provider unavailable' }), { status: 502 })));
    await expect(getCurrentAir(profile)).rejects.toThrow('Provider unavailable');
  });
});
