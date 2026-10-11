import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOutlookCache } from './outlookCache';
import type { OutlookResponse } from '../../shared/outlook-cache.mjs';
import type { Profile } from '../core/types';

const profile: Profile = { ageGroup: 'prefer', health: [], other: '', location: 'Kuala Lumpur', language: 'en', guest: true };
const prediction = (): OutlookResponse => ({ outlook: {
  status: 'estimated', trend: 'easing', summary: 'Possible relief within ~12 hours.', confidence: 'very_low', reason: null,
  generatedAt: '2026-10-11T00:00:00Z', location: profile.location, limitations: [],
  source: 'NewsData.io', timeZone: 'Asia/Kuala_Lumpur', updatedAt: '2026-10-11T00:00:00Z', articlesChecked: 1,
  method: { name: 'news_haze_heuristic', query: 'haze', maximumArticleAgeHours: 48, heuristicRules: {} },
  alleviation: { expected: true, timeframe: { start: '2026-10-11T00:00:00Z', end: '2026-10-11T12:00:00Z', label: 'Within ~12 hours', reportedText: null, resolution: 'heuristic_window', timeZone: 'Asia/Kuala_Lumpur', basis: 'heuristic', rule: 'worsening_risk', anchorAt: '2026-10-11T00:00:00Z' }, evidence: [], basis: 'heuristic', rationale: 'Test estimate.' },
  anotherWave: { expected: null, timeframe: null, evidence: [], basis: null, rationale: null },
}, news: { articles: [], source: 'NewsData.io', status: 'ready', stale: false, updatedAt: '2026-10-11T00:00:00Z', error: null } });
function storage() {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) || null, setItem: (key: string, value: string) => { items.set(key, value); } };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });

describe('last good haze outlook cache', () => {
  it('survives reloads and preserves dates without moving expired windows forward', () => {
    const disk = storage();
    createOutlookCache(() => disk).save(prediction());
    const reloaded = createOutlookCache(() => disk).get('  KUALA   LUMPUR ', 'refresh_failed', new Date('2026-10-15T00:00:00Z'))!;
    expect(reloaded.outlook.cache).toMatchObject({ savedAt: '2026-10-11T00:00:00Z', reason: 'refresh_failed' });
    expect(reloaded.outlook.alleviation.timeframe).toMatchObject({ end: '2026-10-11T12:00:00Z', label: expect.stringContaining('window ended') });
    expect(reloaded.outlook.summary).not.toContain('Within ~12 hours');
    expect(reloaded.news.stale).toBe(true);
  });
  it('never replaces a good prediction with unavailable, older or cached results', () => {
    const cache = createOutlookCache(() => storage());
    cache.save(prediction());
    cache.save({ ...prediction(), outlook: { ...prediction().outlook, status: 'unavailable' } });
    cache.save({ ...prediction(), outlook: { ...prediction().outlook, generatedAt: '2026-10-10T00:00:00Z' } });
    cache.save(cache.get(profile.location)!);
    expect(cache.get(profile.location)?.outlook.generatedAt).toBe('2026-10-11T00:00:00Z');
    expect(cache.get('Penang')).toBeNull();
  });
  it('uses memory when storage is blocked and rejects corrupt saved data', () => {
    const blocked = createOutlookCache(() => { throw new Error('blocked'); });
    blocked.save(prediction()); expect(blocked.get(profile.location)?.outlook.status).toBe('estimated');
    const corrupt = createOutlookCache(() => ({ getItem: () => '{bad json', setItem() {} }));
    expect(corrupt.get(profile.location)).toBeNull();
    corrupt.save(prediction()); expect(corrupt.get(profile.location)?.outlook.status).toBe('estimated');
  });
  it('persists a server-cached prediction on a first visit without making it younger', () => {
    const disk = storage(), server = createOutlookCache(() => undefined);
    server.save(prediction());
    const response = server.get(profile.location, 'refresh_failed', new Date('2026-10-15T00:00:00Z'))!;
    createOutlookCache(() => disk).save(response);
    expect(createOutlookCache(() => disk).get(profile.location)?.outlook.cache?.savedAt).toBe('2026-10-11T00:00:00Z');
  });
});

describe('haze outlook refresh fallback', () => {
  async function setup() {
    vi.resetModules();
    vi.stubGlobal('localStorage', storage());
    const { getHazeOutlook } = await import('./airQuality');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(prediction())));
    await getHazeOutlook(profile);
    return getHazeOutlook;
  }
  it('falls back for empty news, HTTP failures, invalid JSON, malformed data and network errors', async () => {
    const getHazeOutlook = await setup();
    for (const response of [
      () => Response.json({ ...prediction(), outlook: { ...prediction().outlook, status: 'unavailable', reason: 'no_recent_local_reports' } }),
      () => Response.json({ error: 'upstream down' }, { status: 502 }),
      () => new Response('<html>bad gateway</html>'),
      () => Response.json({ outlook: { status: 'estimated' } }),
      () => { throw new TypeError('Failed to fetch'); },
    ]) {
      vi.stubGlobal('fetch', vi.fn(async () => response()));
      const result = await getHazeOutlook(profile);
      expect(result.outlook.status).toBe('estimated'); expect(result.outlook.cache?.status).toBe('cached');
      expect(result.outlook.generatedAt).toBe(prediction().outlook.generatedAt);
    }
  });
  it('serves cached data on a timeout, but respects cancellation on navigation', async () => {
    const getHazeOutlook = await setup();
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));
    const slow = getHazeOutlook(profile);
    await vi.advanceTimersByTimeAsync(12000);
    expect((await slow).outlook.cache?.reason).toBe('refresh_timeout');
    const controller = new AbortController();
    const cancelled = getHazeOutlook(profile, controller.signal);
    const rejected = expect(cancelled).rejects.toThrow('Aborted');
    controller.abort(); await rejected;
  });
  it('replaces the cached result after recovery without mixing city predictions', async () => {
    const getHazeOutlook = await setup();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Offline'); }));
    await expect(getHazeOutlook({ ...profile, location: 'Penang' })).rejects.toThrow('Offline');
    const newer = { ...prediction(), outlook: { ...prediction().outlook, generatedAt: '2026-10-12T00:00:00Z', summary: 'New prediction.' } };
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(newer)));
    expect((await getHazeOutlook(profile)).outlook.cache).toBeUndefined();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Offline'); }));
    expect((await getHazeOutlook(profile)).outlook.generatedAt).toBe('2026-10-12T00:00:00Z');
  });
});
