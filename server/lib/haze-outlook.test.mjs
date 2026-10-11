import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estimateHazeOutlook, estimateReusableHazeOutlook } from './haze-outlook.mjs';
import { createHazeOutlookHandler, createHazeNewsService } from './haze-outlook-api.mjs';
import vercelHandler from '../../api/haze-outlook.js';

const now = new Date('2026-10-11T00:00:00Z');
const article = (title, overrides = {}) => ({ id: title, title, description: '', url: 'https://publisher.example/haze', publisher: 'Publisher', publishedAt: '2026-10-10 12:00:00', publishedAtTimezone: 'UTC', ...overrides });
const feed = articles => ({ articles, status: 'ready', stale: false, updatedAt: now.toISOString(), error: null });
const estimate = (...articles) => estimateHazeOutlook(feed(articles), 'Kuala Lumpur', now);

describe('news-based haze outlook', () => {
  it('extracts explicit easing, attribution and tomorrow relative to publication', () => {
    const result = estimate(article('Kuala Lumpur haze may ease tomorrow'));
    assert.equal(result.trend, 'easing'); assert.equal(result.status, 'estimated');
    assert.equal(result.alleviation.expected, true); assert.equal(result.anotherWave.expected, null);
    assert.equal(result.alleviation.timeframe.start, '2026-10-10T16:00:00.000Z');
    assert.equal(result.alleviation.timeframe.end, '2026-10-11T16:00:00.000Z');
    assert.match(result.alleviation.timeframe.label, /reported 10 Oct/);
    assert.equal(result.alleviation.evidence[0].publisher, 'Publisher');
    assert.equal(result.alleviation.evidence[0].url, 'https://publisher.example/haze');
    assert.equal(result.confidence, 'low');
  });
  it('extracts worsening and relative numeric/word durations', () => {
    for (const phrase of ['within two days', 'within 48 hours', 'over the next 2 days', 'for two days']) {
      const result = estimate(article('KL haze is expected to worsen ' + phrase));
      assert.equal(result.trend, 'mixed'); // Reported worsening plus a later assumed relief window.
      assert.equal(result.anotherWave.timeframe.basis, 'reported');
      assert.equal(result.anotherWave.timeframe.start, '2026-10-10T12:00:00.000Z');
      assert.equal(result.anotherWave.timeframe.end, '2026-10-12T12:00:00.000Z');
    }
    const future = estimate(article('KL haze will return in 2 days'));
    assert.equal(future.anotherWave.timeframe.start, '2026-10-12T12:00:00.000Z');
  });
  it('handles Malay future phrases', () => {
    const result = estimate(article('Jerebu Kuala Lumpur dijangka berkurang esok'));
    assert.equal(result.trend, 'easing'); assert.ok(result.alleviation.timeframe);
  });
  it('preserves independent conflicting/sequence reports rather than voting', () => {
    const result = estimate(article('KL haze may ease tomorrow'), article('KL haze could return in three days'));
    assert.equal(result.trend, 'mixed'); assert.equal(result.alleviation.expected, true); assert.equal(result.anotherWave.expected, true);
  });
  it('fills a reported future trend with a labelled heuristic window when timing is absent', () => {
    const result = estimate(article('KL haze is likely to persist'));
    assert.equal(result.anotherWave.expected, true); assert.equal(result.anotherWave.basis, 'reported');
    assert.equal(result.anotherWave.timeframe.basis, 'heuristic');
    assert.equal(result.anotherWave.timeframe.rule, 'worsening_risk');
    assert.equal(result.confidence, 'very_low'); assert.match(result.summary, /Rough heuristic/);
  });
  it('does not infer from negations, irrelevant topics or ambiguous claims', () => {
    for (const title of ['KL haze is not expected to worsen tomorrow', 'KL haze is unlikely to ease tomorrow', 'No haze expected in KL tomorrow', 'KL economy will improve tomorrow', 'KL haze may ease or worsen tomorrow']) {
      const result = estimate(article(title));
      assert.equal(result.status, 'unavailable', title); assert.equal(result.alleviation.expected, null); assert.equal(result.anotherWave.expected, null);
    }
  });
  it('does not assign foreign haze or publisher-country metadata to Kuala Lumpur', () => {
    const result = estimate(article('Singapore haze may worsen tomorrow', { countries: ['malaysia'] }));
    assert.equal(result.reason, 'no_recent_local_reports'); assert.equal(result.articlesChecked, 0);
  });
  it('recognizes a station city without requiring the entire comma-separated station label in an article', () => {
    const result = estimateHazeOutlook(feed([article('Petaling Jaya haze may ease tomorrow')]), 'Petaling Jaya, Selangor, Malaysia', now);
    assert.equal(result.trend, 'easing');
  });
  it('rejects stale, future, timezone-unknown articles and expired windows', () => {
    for (const override of [{ publishedAt: '2026-10-08 00:00:00' }, { publishedAt: '2026-10-12 00:00:00' }, { publishedAtTimezone: null }, { publishedAt: '2026-10-09 12:00:00' }]) {
      const result = estimate(article('KL haze may ease tomorrow', override));
      assert.equal(result.status, 'unavailable'); assert.equal(result.alleviation.expected, null);
    }
  });
  it('does not use stale feeds, and discloses unavailable data without a false no-wave claim', () => {
    const result = estimateHazeOutlook({ ...feed([article('KL haze may ease tomorrow')]), stale: true }, 'Kuala Lumpur', now);
    assert.equal(result.reason, 'stale_news'); assert.equal(result.alleviation.expected, null);
    assert.equal(estimate().reason, 'no_recent_local_reports');
    assert.equal(estimateHazeOutlook({ status: 'unavailable', error: 'News is not configured.' }, 'Kuala Lumpur', now).summary, 'News is not configured.');
  });
  it('does not count the same article twice across title and description', () => {
    const result = estimate(article('KL haze may ease tomorrow', { description: 'KL haze may ease tomorrow.' }));
    assert.equal(result.alleviation.evidence.length, 1);
  });
  it('provides rough relief and near-term worsening windows for a current local haze report', () => {
    const result = estimate(article('KL morning cancelled due to worsening haze'));
    assert.equal(result.status, 'estimated'); assert.equal(result.confidence, 'very_low');
    assert.equal(result.alleviation.basis, 'heuristic'); assert.equal(result.anotherWave.basis, 'heuristic');
    assert.equal(result.alleviation.timeframe.start, '2026-10-12T12:00:00.000Z');
    assert.equal(result.alleviation.timeframe.end, '2026-10-14T12:00:00.000Z');
    assert.equal(result.anotherWave.timeframe.end, '2026-10-11T12:00:00.000Z');
    assert.equal(result.alleviation.timeframe.label, 'Roughly 2–4 days');
    assert.equal(result.anotherWave.timeframe.label, 'Within ~12 hours');
    assert.equal(result.alleviation.timeframe.reportedText, null);
    assert.match(result.alleviation.rationale, /Default assumption/);
  });
  it('uses a shorter relief window for reported or expected rain, including weather-only descriptions', () => {
    const result = estimate(article('KL haze outlook', { description: 'Rain is expected over the city.' }));
    assert.equal(result.alleviation.timeframe.rule, 'rain_relief');
    assert.equal(result.alleviation.timeframe.end, '2026-10-12T00:00:00.000Z');
    assert.equal(result.anotherWave.expected, null);
  });
  it('uses a slower relief window for dry weather and burning signals', () => {
    const result = estimate(article('KL haze persists amid dry weather and forest fires'));
    assert.equal(result.alleviation.timeframe.rule, 'dry_relief');
    assert.equal(result.alleviation.timeframe.end, '2026-10-15T12:00:00.000Z');
    assert.equal(result.anotherWave.timeframe.rule, 'dry_risk');
  });
  it('prefers explicitly reported timing over fallback estimates', () => {
    const result = estimate(article('KL haze may ease within seven days'), article('KL haze outlook', { description: 'Rain is expected over the city.' }));
    assert.equal(result.alleviation.timeframe.basis, 'reported');
    assert.equal(result.alleviation.timeframe.end, '2026-10-17T12:00:00.000Z');
    assert.equal(result.alleviation.timeframe.rule, null);
  });
  it('does not restart or extend fallback windows when the same article is refreshed', () => {
    const articles = [article('KL haze is worsening')];
    const first = estimateHazeOutlook(feed(articles), 'Kuala Lumpur', now);
    const later = estimateHazeOutlook(feed(articles), 'Kuala Lumpur', new Date('2026-10-11T13:00:00Z'));
    assert.equal(later.alleviation.timeframe.start, first.alleviation.timeframe.start);
    assert.equal(later.alleviation.timeframe.end, first.alleviation.timeframe.end);
    assert.equal(later.anotherWave.expected, null); // The 24-hour worsening window has expired.
  });
});

describe('reusable news outlook', () => {
  it('uses national Malaysian haze news when a Kuala Lumpur headline is missing', () => {
    const result = estimateReusableHazeOutlook(feed([
      article('Haze: State education directors to decide on school operations', { countries: ['malaysia'], description: 'The Education Ministry is monitoring haze impacts.' }),
      article('JKR street lights to stay lit longer during haze', { countries: ['malaysia'] }),
    ]), 'Kuala Lumpur', now);
    assert.equal(result.status, 'estimated'); assert.equal(result.newsBasis.scope, 'malaysia');
    assert.equal(result.confidence, 'very_low'); assert.equal(result.articlesChecked, 2);
    assert.equal(result.alleviation.timeframe.rule, 'episode_relief');
    assert.match(result.summary, /Malaysia-wide/); assert.match(result.newsBasis.label, /city-specific news was not available/);
  });
  it('prefers local evidence over national fallback', () => {
    const result = estimateReusableHazeOutlook(feed([
      article('KL haze easing after rain'), article('Malaysia haze persists amid dry weather'),
    ]), 'Kuala Lumpur', now);
    assert.equal(result.newsBasis.scope, 'local'); assert.equal(result.articlesChecked, 1);
    assert.equal(result.alleviation.timeframe.rule, 'rain_relief');
  });
  it('reuses stale articles even without a previously saved prediction', () => {
    const result = estimateReusableHazeOutlook({ ...feed([article('KL haze is worsening')]), status: 'stale', stale: true }, 'Kuala Lumpur', now);
    assert.equal(result.status, 'estimated'); assert.equal(result.newsBasis.reused, true);
    assert.equal(result.cache.reason, 'reused_news'); assert.equal(result.cache.savedAt, '2026-10-10T12:00:00.000Z');
    assert.equal(result.anotherWave.timeframe.end, '2026-10-11T12:00:00.000Z');
  });
  it('reuses news beyond 48 hours and marks its original windows as ended', () => {
    const source = feed([article('Malaysia haze may ease tomorrow', { publishedAt: '2026-10-01 12:00:00' })]);
    const result = estimateReusableHazeOutlook(source, 'Kuala Lumpur', now);
    const repeated = estimateReusableHazeOutlook({ ...source, updatedAt: '2026-10-15T00:00:00Z' }, 'Kuala Lumpur', new Date('2026-10-15T00:00:00Z'));
    assert.equal(result.status, 'estimated'); assert.equal(result.newsBasis.scope, 'malaysia'); assert.equal(result.newsBasis.reused, true);
    assert.match(result.alleviation.timeframe.label, /window ended/);
    assert.equal(result.alleviation.timeframe.end, repeated.alleviation.timeframe.end);
    assert.equal(result.generatedAt, repeated.generatedAt);
    assert.ok(!result.summary.includes('tomorrow'));
  });
  it('reconstructs expired reported timing even when the source was retrieved again today', () => {
    const result = estimateReusableHazeOutlook(feed([article('KL haze may ease today', { publishedAt: '2026-10-09 12:00:00' })]), 'Kuala Lumpur', now);
    assert.equal(result.status, 'estimated'); assert.equal(result.newsBasis.reused, true);
    assert.match(result.alleviation.timeframe.label, /window ended/);
  });
  it('does not turn foreign news, entertainment, ambiguous or invalid-dated articles into Malaysian forecasts', () => {
    for (const item of [
      article('Singapore haze worsens', { countries: ['malaysia'] }),
      article('Film review', { countries: ['malaysia'], description: 'Haze and pollution in a fictional Malaysia.' }),
      article('Malaysia haze may ease or worsen tomorrow'),
      article('Malaysia haze may ease tomorrow', { publishedAtTimezone: null }),
      article('Malaysia haze worsens', { publishedAt: '2026-10-12 12:00:00' }),
    ]) {
      const result = estimateReusableHazeOutlook(feed([item]), 'Kuala Lumpur', now);
      assert.equal(result.status, 'unavailable', item.title);
    }
    assert.equal(estimateReusableHazeOutlook(feed([article('Malaysia haze worsens')]), 'Singapore', now).status, 'unavailable');
  });
});

async function invoke(handler, url = '/api/haze-outlook', method = 'GET') {
  const result = {};
  await handler({ url, method }, { writeHead(status, headers) { result.status = status; result.headers = headers; }, end(raw) { result.body = JSON.parse(raw); } });
  return result;
}

describe('NewsData haze outlook endpoint', () => {
  it('exports a Vercel handler and makes one q=haze search using only the server key', async () => {
    assert.equal(typeof vercelHandler, 'function');
    let calls = 0;
    const news = createHazeNewsService({ apiKey: 'private-test-key', now: () => now.getTime(), fetchImpl: async (url, init) => {
      calls++;
      assert.equal(url.origin + url.pathname, 'https://newsdata.io/api/1/latest');
      assert.equal(url.searchParams.get('q'), 'haze'); assert.equal(url.searchParams.has('apikey'), false);
      assert.equal(url.searchParams.has('country'), false); assert.equal(url.searchParams.has('language'), false);
      assert.equal(init.headers['X-ACCESS-KEY'], 'private-test-key');
      return Response.json({ status: 'success', results: [{ article_id: '1', title: 'KL haze may ease tomorrow', link: 'https://publisher.example/haze', pubDate: '2026-10-10 12:00:00', pubDateTZ: 'UTC', source_name: 'Publisher' }] });
    } });
    const handler = createHazeOutlookHandler({ news, now: () => now });
    const response = await invoke(handler, '/api/haze-outlook?location=Kuala+Lumpur&apikey=client-key');
    assert.equal(response.status, 200); assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['x-haze-outlook-version'], 'news-reuse-v2');
    assert.equal(response.body.outlook.trend, 'easing'); assert.equal(response.body.news.articles.length, 1);
    assert.ok(!JSON.stringify(response.body).includes('private-test-key'));
    await invoke(handler); assert.equal(calls, 1);
  });
  it('validates methods and location before contacting the provider, and sanitizes failures', async () => {
    let calls = 0;
    const handler = createHazeOutlookHandler({ news: { get: async () => { calls++; throw new Error('private detail'); } } });
    assert.equal((await invoke(handler, '/api/haze-outlook', 'POST')).status, 405);
    assert.equal((await invoke(handler, '/api/haze-outlook?location=%3Cscript%3E')).status, 400);
    assert.equal(calls, 0);
    const failed = await invoke(handler); assert.equal(failed.status, 200); assert.equal(failed.body.outlook.status, 'unavailable'); assert.ok(!JSON.stringify(failed).includes('private detail'));
  });
  it('returns unknown outlook for missing configuration without requesting a provider', async () => {
    const news = createHazeNewsService({ apiKey: '', fetchImpl: async () => { throw new Error('must not call'); } });
    const response = await invoke(createHazeOutlookHandler({ news, now: () => now }));
    assert.equal(response.status, 200); assert.equal(response.body.outlook.reason, 'news_unavailable');
    assert.match(response.body.outlook.summary, /NEWSDATA_API_KEY/);
  });

  it('retains a good prediction through empty news, stale news and provider exceptions', async () => {
    let time = now;
    let result = feed([article('KL haze may ease tomorrow')]);
    const handler = createHazeOutlookHandler({ news: { get: async () => {
      if (result instanceof Error) throw result;
      return result;
    } }, now: () => time });
    const first = (await invoke(handler)).body;
    for (const failure of [feed([]), { ...feed([]), stale: true }, new Error('private error')]) {
      result = failure; time = new Date('2026-10-13T00:00:00Z');
      const response = await invoke(handler);
      assert.equal(response.status, 200);
      assert.equal(response.body.outlook.status, 'estimated');
      assert.equal(response.body.outlook.cache.status, 'cached');
      assert.equal(response.body.outlook.generatedAt, first.outlook.generatedAt);
      assert.equal(response.body.outlook.alleviation.timeframe.end, first.outlook.alleviation.timeframe.end);
      assert.match(response.body.outlook.alleviation.timeframe.label, /window ended/);
      assert.ok(!response.body.outlook.summary.includes('tomorrow'));
      assert.ok(!JSON.stringify(response.body).includes('private error'));
    }
  });

  it('shares last good predictions across handler instances and keeps cities isolated', async () => {
    const cache = new Map();
    const first = createHazeOutlookHandler({ cache, news: { get: async () => feed([article('KL haze may ease tomorrow')]) }, now: () => now });
    await invoke(first);
    const restarted = createHazeOutlookHandler({ cache, news: { get: async () => feed([]) }, now: () => now });
    assert.equal((await invoke(restarted)).body.outlook.cache.status, 'cached');
    const otherCity = await invoke(restarted, '/api/haze-outlook?location=Petaling+Jaya');
    assert.equal(otherCity.body.outlook.status, 'unavailable');
    assert.equal(otherCity.body.outlook.cache, undefined);
  });

  it('replaces the saved prediction after recovery, even when shared caching fails', async () => {
    let articles = [article('KL haze may ease tomorrow')];
    const brokenCache = { get: async () => { throw new Error('cache down'); }, set: async () => { throw new Error('cache down'); } };
    const handler = createHazeOutlookHandler({ cache: brokenCache, news: { get: async () => feed(articles) }, now: () => now });
    await invoke(handler);
    articles = []; assert.equal((await invoke(handler)).body.outlook.cache.status, 'cached');
    articles = [article('KL haze may worsen tomorrow')];
    const recovered = (await invoke(handler)).body;
    assert.equal(recovered.outlook.trend, 'mixed'); assert.equal(recovered.outlook.anotherWave.expected, true); assert.equal(recovered.outlook.cache, undefined);
    articles = [];
    assert.equal((await invoke(handler)).body.outlook.anotherWave.expected, true);
  });

  it('ignores malformed or wrong-city shared cache entries', async () => {
    for (const stored of [{ outlook: { status: 'estimated' } }, {
      outlook: estimateHazeOutlook(feed([article('Penang haze may ease tomorrow')]), 'Penang', now), news: feed([]),
    }]) {
      const handler = createHazeOutlookHandler({ cache: { get: async () => stored }, news: { get: async () => feed([]) }, now: () => now });
      assert.equal((await invoke(handler)).body.outlook.status, 'unavailable');
    }
  });
  it('shares the refresh interval across cold starts and retries failures sooner', async () => {
    const cache = new Map();
    let time = now, calls = 0, fail = false;
    const news = { intervalMs: 3 * 3600000, retryMs: 15 * 60000, get: async () => {
      calls++; if (fail) throw new Error('upstream down');
      return feed([article('KL haze may ease tomorrow')]);
    } };
    await invoke(createHazeOutlookHandler({ cache, news, now: () => time }));
    const restarted = createHazeOutlookHandler({ cache, news, now: () => time });
    await invoke(restarted); assert.equal(calls, 1);
    time = new Date(now.getTime() + 3 * 3600000); fail = true;
    assert.equal((await invoke(restarted)).body.outlook.cache.status, 'cached'); assert.equal(calls, 2);
    time = new Date(time.getTime() + 14 * 60000);
    await invoke(restarted); assert.equal(calls, 2);
    time = new Date(time.getTime() + 60000);
    await invoke(restarted); assert.equal(calls, 3);
  });
  it('returns a prediction from the national reports in the first page and caches reused news', async () => {
    const cache = new Map();
    const news = { get: async () => feed([article('Haze: State education directors to decide school operations', { countries: ['malaysia'], publishedAt: '2026-10-01 12:00:00' })]) };
    const handler = createHazeOutlookHandler({ cache, news, now: () => now });
    const response = await invoke(handler);
    assert.equal(response.body.outlook.status, 'estimated'); assert.equal(response.body.outlook.newsBasis.reused, true);
    assert.equal(cache.size, 1);
    const restarted = createHazeOutlookHandler({ cache, news: { get: async () => { throw Error('offline'); } }, now: () => now });
    assert.equal((await invoke(restarted)).body.outlook.status, 'estimated');
  });
});
