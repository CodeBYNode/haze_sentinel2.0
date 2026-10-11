import { cachedOutlook, hasUsableOutlook, outlookLocationKey, type OutlookResponse } from '../../shared/outlook-cache.mjs';

const STORAGE_KEY = 'haze-sentinel-outlooks-v1';
const MAX_LOCATIONS = 32;
type CacheStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function createOutlookCache(storage: () => CacheStorage | undefined = () => globalThis.localStorage) {
  const memory = new Map<string, OutlookResponse>();
  const read = (location: string): OutlookResponse | null => {
    const key = outlookLocationKey(location);
    let value = memory.get(key) || null;
    try {
      const stored = JSON.parse(storage()?.getItem(STORAGE_KEY) || '{}')[key];
      if (hasUsableOutlook(stored, location) && (!value || Date.parse(stored.outlook.generatedAt) > Date.parse(value.outlook.generatedAt))) value = stored;
    } catch { /* Keep the in-session copy when storage is blocked or corrupt. */ }
    if (value) memory.set(key, value);
    return value;
  };
  return {
    get(location: string, reason = 'refresh_pending', now?: Date) {
      const value = read(location);
      return value ? cachedOutlook(value, reason, now) : null;
    },
    save(value: OutlookResponse) {
      if (!hasUsableOutlook(value, value.outlook.location)) return;
      const key = outlookLocationKey(value.outlook.location);
      const previous = read(key);
      if (previous && Date.parse(previous.outlook.generatedAt) >= Date.parse(value.outlook.generatedAt)) return;
      // A valid server-cached result can initialize a new browser without changing its original age.
      value = { outlook: { ...value.outlook, cache: undefined }, news: value.news };
      memory.delete(key); memory.set(key, value);
      if (memory.size > MAX_LOCATIONS) memory.delete(memory.keys().next().value!);
      let entries: [string, unknown][] = [];
      try {
        const raw: unknown = JSON.parse(storage()?.getItem(STORAGE_KEY) || '{}');
        entries = raw && typeof raw === 'object' ? Object.entries(raw).filter(([city, item]) => hasUsableOutlook(item, city)) : [];
      } catch { /* Replace corrupt storage with the valid in-session entries. */ }
      try {
        const merged = new Map<string, OutlookResponse>(entries as [string, OutlookResponse][]);
        for (const [city, item] of memory) merged.set(city, item);
        const newest = [...merged].sort((a, b) => Date.parse(b[1].outlook.generatedAt) - Date.parse(a[1].outlook.generatedAt)).slice(0, MAX_LOCATIONS);
        storage()?.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(newest)));
      } catch { /* A working memory cache still protects refreshes in this session. */ }
    },
  };
}

export const hazeOutlookCache = createOutlookCache();
