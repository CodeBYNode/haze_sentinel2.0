import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NewsDataService, normalizeNewsResponse } from './newsdata.mjs';

const article = (overrides = {}) => ({
  article_id: 'a1', title: 'Malaysia haze triggers school closure advisory', link: 'https://publisher.example/haze-school',
  source_id: 'publisher-one', source_name: 'Publisher One', source_url: 'https://publisher.example',
  pubDate: '2026-10-10 10:00:00', pubDateTZ: 'UTC', description: 'Officials advised schools to close amid haze.',
  image_url: 'https://publisher.example/image.jpg', keywords: ['haze'], country: ['malaysia'], language: 'english', category: ['environment'], creator: ['Reporter'], ...overrides,
});
const response = results => async () => new Response(JSON.stringify({ status: 'success', totalResults: results.length, results }), { status: 200 });

describe('NewsData normalization', () => {
  it('extracts attribution, dates, descriptions and metadata while filtering irrelevant stories', () => {
    const news = normalizeNewsResponse({ status: 'success', results: [article(), article({ article_id: 'irrelevant', title: 'Malaysia wins football match', description: 'A sports report.', keywords: [] }), article({ article_id: 'bad', title: '', link: '' })] });
    assert.equal(news.length, 1);
    assert.equal(news[0].publisher, 'Publisher One');
    assert.equal(news[0].publishedAt, '2026-10-10 10:00:00');
    assert.equal(news[0].url, 'https://publisher.example/haze-school');
    assert.equal(news[0].authors[0], 'Reporter');
  });

  it('groups repeated/syndicated headlines and retains every publisher link', () => {
    const news = normalizeNewsResponse({ status: 'success', results: [article(), article({ article_id: 'a2', source_id: 'publisher-two', source_name: 'Publisher Two', source_url: 'https://two.example', link: 'https://two.example/story' })] });
    assert.equal(news.length, 1);
    assert.deepEqual(news[0].sources.map(s => s.name), ['Publisher One', 'Publisher Two']);
    assert.deepEqual(news[0].sources.map(s => s.url), ['https://publisher.example/haze-school', 'https://two.example/story']);
  });

  it('rejects malformed provider payloads', () => {
    assert.throws(() => normalizeNewsResponse({ status: 'success', results: {} }), /malformed/);
  });
});

describe('NewsData cache and retrieval', () => {
  it('coalesces concurrent refreshes and reuses the three-hour cache', async () => {
    let now = Date.parse('2026-10-10T00:00:00Z'), calls = 0;
    const service = new NewsDataService({ apiKey: 'test-key', intervalHours: 3, now: () => now, fetchImpl: async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return response([article()])(); } });
    const [one, two] = await Promise.all([service.get(), service.get()]);
    assert.equal(calls, 2);
    assert.equal(one.articles.length, 1);
    assert.equal(two.updatedAt, one.updatedAt);
    await service.get();
    assert.equal(calls, 2);
    now += 3 * 60 * 60 * 1000;
    await service.get();
    assert.equal(calls, 4);
  });

  it('uses the documented JSON endpoint and keeps the key in a request header', async () => {
    let calls = 0;
    const service = new NewsDataService({ apiKey: 'private-test-key', fetchImpl: async (url, options) => {
      calls++;
      assert.equal(new URL(url).origin + new URL(url).pathname, 'https://newsdata.io/api/1/latest');
      assert.ok(new URL(url).searchParams.get('q').length <= 100);
      assert.equal(new URL(url).searchParams.has('apikey'), false);
      assert.equal(options.headers['X-ACCESS-KEY'], 'private-test-key');
      return response([article()])();
    } });
    const result = await service.get();
    assert.equal(calls, 2);
    assert.equal(result.articles.length, 1);
    assert.equal(JSON.stringify(result).includes('private-test-key'), false);
  });

  it('returns stale articles and the last successful timestamp after refresh failure', async () => {
    let now = Date.parse('2026-10-10T00:00:00Z'), fail = false, calls = 0;
    const service = new NewsDataService({ apiKey: 'test-key', intervalHours: 3, retryMs: 60000, now: () => now, fetchImpl: async () => { calls++; if (fail) return new Response('{', { status: 200 }); return response([article()])(); } });
    const initial = await service.get();
    fail = true;
    now += 4 * 60 * 60 * 1000;
    const stale = await service.get();
    assert.equal(stale.stale, true);
    assert.equal(stale.articles.length, 1);
    assert.equal(stale.updatedAt, initial.updatedAt);
    assert.ok(stale.error);
    await service.get();
    assert.equal(calls, 4);
  });

  it('surfaces missing key without network traffic', async () => {
    let calls = 0;
    const service = new NewsDataService({ apiKey: '', fetchImpl: async () => { calls++; } });
    const result = await service.get();
    assert.equal(result.status, 'unavailable');
    assert.match(result.error, /NEWSDATA_API_KEY/);
    assert.equal(calls, 0);
  });

  it('does not expose credentials and describes rate-limit failures', async () => {
    const service = new NewsDataService({ apiKey: 'sensitive-test-key', fetchImpl: async () => new Response(JSON.stringify({ status: 'error', results: { message: 'Rate limit exceeded' } }), { status: 429 }) });
    const result = await service.get();
    assert.match(result.error, /rate limit reached/i);
    assert.equal(result.status, 'unavailable');
    assert.equal(result.stale, false);
    assert.equal(JSON.stringify(result).includes('sensitive-test-key'), false);
  });
});
