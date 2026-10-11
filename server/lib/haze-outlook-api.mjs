import { NewsDataService } from './newsdata.mjs';
import { estimateReusableHazeOutlook } from './haze-outlook.mjs';
import { cachedOutlook, hasUsableOutlook, outlookLocationKey } from '../../shared/outlook-cache.mjs';

export const createHazeNewsService = options => new NewsDataService({ maxPages: 2, timeoutMs: 4500, ...options, queries: ['haze'], countries: null, languages: null });
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-haze-outlook-version': 'news-reuse-v2', ...headers });
  res.end(JSON.stringify(body));
};

// Cache outages must not block either a live estimate or the in-process fallback.
async function cacheOperation(operation) {
  let timer;
  try { return await Promise.race([Promise.resolve().then(operation), new Promise(resolve => { timer = setTimeout(resolve, 800); })]); }
  catch { return undefined; }
  finally { clearTimeout(timer); }
}

export function createHazeOutlookHandler({ news = createHazeNewsService(), now = () => new Date(), cache } = {}) {
  const memory = new Map();
  return async (req, res) => {
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.' }, { allow: 'GET' });
    let location;
    try { location = new URL(req.url || '/', 'http://localhost').searchParams.get('location')?.trim() || 'Kuala Lumpur'; }
    catch { return send(res, 400, { error: 'Invalid request URL.' }); }
    if (!/^[a-z0-9 .,'()-]{2,100}$/i.test(location)) return send(res, 400, { error: 'Provide a valid location name.' });
    const key = 'haze-outlook-v1:' + outlookLocationKey(location);
    const stored = cache ? await cacheOperation(() => cache.get(key)) : null;
    let previous = memory.get(key);
    if (hasUsableOutlook(stored, location) && (!previous || Date.parse(stored.outlook.generatedAt) > Date.parse(previous.outlook.generatedAt)
      || (stored.outlook.generatedAt === previous.outlook.generatedAt && Date.parse(stored.refreshAfter) > Date.parse(previous.refreshAfter)))) previous = stored;
    const remember = value => {
      memory.delete(key); memory.set(key, value);
      if (memory.size > 128) memory.delete(memory.keys().next().value);
    };
    if (previous) {
      remember(previous);
      if (Date.parse(previous.refreshAfter) > now().getTime()) {
        return send(res, 200, cachedOutlook(previous, 'refresh_not_due', now()));
      }
    }
    let feed;
    try { feed = await news.get(); }
    catch { feed = { articles: [], source: 'NewsData.io', status: 'unavailable', stale: false, updatedAt: null, error: 'Haze news could not be refreshed.' }; }
    const refreshDelay = ['ready', 'partial'].includes(feed?.status) && !feed.stale ? news.intervalMs || 0 : news.retryMs || 0;
    const current = { outlook: estimateReusableHazeOutlook(feed, location, now()), news: feed,
      refreshAfter: new Date(now().getTime() + refreshDelay).toISOString() };
    if (previous && current.outlook.cache && Date.parse(previous.outlook.generatedAt) >= Date.parse(current.outlook.generatedAt)) {
      const lastGood = { ...previous, refreshAfter: current.refreshAfter };
      remember(lastGood);
      if (cache) await cacheOperation(() => cache.set(key, lastGood));
      return send(res, 200, cachedOutlook(lastGood, 'reused_news', now()));
    }
    if (hasUsableOutlook(current, location)) {
      remember(current);
      // No expiry: retain the last good estimate until replaced (or the platform evicts it).
      if (cache) await cacheOperation(() => cache.set(key, current));
      return send(res, 200, current);
    }
    if (previous) {
      // Share the refresh cadence across cold starts without changing the saved prediction's dates.
      const lastGood = { ...previous, refreshAfter: current.refreshAfter };
      remember(lastGood);
      if (cache) await cacheOperation(() => cache.set(key, lastGood));
      return send(res, 200, cachedOutlook(lastGood, current.outlook.reason || 'no_new_prediction', now()));
    }
    return send(res, 200, current);
  };
}
