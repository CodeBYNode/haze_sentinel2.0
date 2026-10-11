import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estimateHazeOutlook } from './haze-outlook.mjs';
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
      assert.equal(result.trend, 'worsening');
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
  it('retains a reported future trend without inventing timing', () => {
    const result = estimate(article('KL haze is likely to persist'));
    assert.equal(result.anotherWave.expected, true); assert.equal(result.anotherWave.timeframe, null);
    assert.match(result.summary, /timing not reported/);
  });
  it('does not predict from current conditions, negations, irrelevant topics or ambiguous claims', () => {
    for (const title of ['KL morning cancelled due to worsening haze', 'KL haze is not expected to worsen tomorrow', 'KL haze is unlikely to ease tomorrow', 'KL economy will improve tomorrow', 'KL haze may ease or worsen tomorrow']) {
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
    const failed = await invoke(handler); assert.equal(failed.status, 502); assert.ok(!JSON.stringify(failed).includes('private detail'));
  });
  it('returns unknown outlook for missing configuration without requesting a provider', async () => {
    const news = createHazeNewsService({ apiKey: '', fetchImpl: async () => { throw new Error('must not call'); } });
    const response = await invoke(createHazeOutlookHandler({ news, now: () => now }));
    assert.equal(response.status, 200); assert.equal(response.body.outlook.reason, 'news_unavailable');
    assert.match(response.body.outlook.summary, /NEWSDATA_API_KEY/);
  });
});
