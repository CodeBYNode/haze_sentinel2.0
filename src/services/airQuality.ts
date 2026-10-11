import type { AQReading, Profile } from '../core/types';
import type { HazeOutlook } from '../core/outlook';
import type { NewsFeed } from './news';
export type StationOption = { name: string; stationId: string; coordinates: { lat: number; lon: number } | null; aqi: number | null };
export type RefreshIntervals = { hazeRefreshIntervalMinutes: number; newsRefreshIntervalHours: number };
export type BackendReading = Omit<AQReading, 'scale' | 'location'> & { indexName?: string };

const message = async (res: Response) => {
  let body;
  try { body = await res.json(); } catch { throw new Error('The HazeAI server returned an invalid response.'); }
  if (!res.ok) throw new Error(body?.error || 'The air-quality service is unavailable.');
  return body;
};
export function normalizeReading(value: BackendReading): AQReading {
  if (!value || typeof value !== 'object' || (value.aqi != null && (typeof value.aqi !== 'number' || !Number.isFinite(value.aqi) || value.aqi < 0))) throw new Error('The server returned an invalid air-quality reading.');
  return { ...value, scale: value.indexName, location: value.station || undefined, pm25: value.pollutants?.pm25, pm10: value.pollutants?.pm10, demo: false };
}
function locationQuery(profile: Profile): string {
  const q = new URLSearchParams();
  if (profile.stationId) q.set('stationId', profile.stationId);
  else if (profile.locationCoords) { q.set('lat', String(profile.locationCoords.lat)); q.set('lon', String(profile.locationCoords.lon)); }
  else q.set('location', profile.location);
  return q.toString();
}
export async function getCurrentAir(profile: Profile, signal?: AbortSignal): Promise<AQReading> {
  const body = await message(await fetch('/api/air-quality?' + locationQuery(profile), { signal, cache: 'no-store' }));
  return { ...normalizeReading(body.reading), stationId: body.reading.stationId || profile.stationId };
}
export async function getHazeOutlook(profile: Profile, signal?: AbortSignal): Promise<{ outlook: HazeOutlook; news: NewsFeed }> {
  const body = await message(await fetch('/api/haze-outlook?' + new URLSearchParams({ location: profile.location }), { signal, cache: 'no-store' }));
  const outlook = body.outlook;
  if (!outlook || !['estimated', 'unavailable'].includes(outlook.status) || typeof outlook.summary !== 'string'
    || !outlook.alleviation || !outlook.anotherWave || !Array.isArray(body.news?.articles)) throw new Error('The server returned an invalid haze outlook.');
  return { outlook, news: body.news };
}
export async function searchStations(query: string, signal?: AbortSignal): Promise<StationOption[]> {
  const body = await message(await fetch('/api/locations/search?q=' + encodeURIComponent(query), { signal, cache: 'no-store' }));
  if (!Array.isArray(body.locations)) throw new Error('Station search returned incomplete data.');
  return body.locations.filter((s: StationOption) => s && typeof s.name === 'string' && /^\d+$/.test(String(s.stationId)))
    .map((s: StationOption) => ({ ...s, stationId: String(s.stationId) }));
}
export async function getRefreshIntervals(signal?: AbortSignal): Promise<RefreshIntervals> {
  try {
    const res = await fetch('/api/config', { signal, cache: 'no-store' });
    if (!res.ok) throw new Error();
    const v = await res.json();
    return {
      hazeRefreshIntervalMinutes: Number.isFinite(Number(v.hazeRefreshIntervalMinutes)) && Number(v.hazeRefreshIntervalMinutes) > 0 ? Number(v.hazeRefreshIntervalMinutes) : 10,
      newsRefreshIntervalHours: Number.isFinite(Number(v.newsRefreshIntervalHours)) && Number(v.newsRefreshIntervalHours) > 0 ? Number(v.newsRefreshIntervalHours) : 3,
    };
  } catch { return { hazeRefreshIntervalMinutes: 10, newsRefreshIntervalHours: 3 }; }
}
