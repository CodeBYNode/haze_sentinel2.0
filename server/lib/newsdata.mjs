const ENDPOINT = 'https://newsdata.io/api/1/latest';
const SEARCHES = [
  'haze OR jerebu OR smoke OR "air quality" OR "forest fire"',
  'haze OR jerebu OR "health advisory" OR sekolah OR closure OR traffic OR transport',
];
const ENVIRONMENTAL = /\b(haze|jerebu|smog|smoke|air quality|air pollution|pollution|pm\s?2[.]?5|pm\s?10|forest fire|wildfire|peat fire|hotspot|open burning|jerebu)\b/i;
const PUBLIC_IMPACT = /\b(school|sekolah|class|classes|closure|closed|health advisory|health alert|health ministry|hospital|respiratory|airport|flight|transport|traffic|road|ferry|train|disruption|cancelled|canceled|ditutup|ditangguh|penerbangan|pengangkutan)\b/i;
const STOP = new Set(['the','and','for','with','from','that','this','after','over','into','near','says','said','news','report']);

const text = value => typeof value === 'string' ? value.trim() : '';
const sourceEntry = item => ({
  name: text(item.source_name) || text(item.source_id) || 'Publisher not provided',
  id: text(item.source_id) || null,
  url: text(item.link) || null,
  publisherUrl: text(item.source_url) || null,
});
const normalizeTitle = value => text(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/https?:\/\/\S+/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const tokenSet = title => new Set(normalizeTitle(title).split(' ').filter(w => w.length > 2 && !STOP.has(w)));
const titleSimilarity = (a, b) => {
  const left = tokenSet(a), right = tokenSet(b);
  if (left.size < 5 || right.size < 5) return 0;
  let overlap = 0;
  for (const word of left) if (right.has(word)) overlap++;
  return overlap / (left.size + right.size - overlap);
};
const fallbackId = article => text(article.article_id) || text(article.link) || normalizeTitle(article.title);

export function normalizeNewsResponse(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.status !== 'success' || !Array.isArray(payload.results)) {
    throw new NewsDataError('NewsData.io returned an incomplete or malformed response.', 'malformed');
  }
  const relevant = payload.results.filter(item => {
    if (!item || typeof item !== 'object' || !text(item.title) || !text(item.link)) return false;
    const content = [item.title,item.description,item.content,...(Array.isArray(item.keywords)?item.keywords:[])].map(text).join(' ');
    return ENVIRONMENTAL.test(content) || (PUBLIC_IMPACT.test(content) && /\b(haze|jerebu|smoke|pollution|air quality|jerebu)\b/i.test(content));
  });
  const groups = [];
  for (const item of relevant) {
    const title = text(item.title);
    const normalized = normalizeTitle(title);
    const found = groups.find(group => group.normalizedTitle === normalized || titleSimilarity(group.title,title) >= 0.86);
    const publisher = sourceEntry(item);
    if (found) {
      if (!found.sources.some(s => s.url === publisher.url || (s.id && publisher.id && s.id === publisher.id))) found.sources.push(publisher);
      if (!found.description && text(item.description)) found.description = text(item.description);
      continue;
    }
    groups.push({
      id: fallbackId(item), title, normalizedTitle: normalized,
      publisher: publisher.name, publisherId: publisher.id, publisherUrl: publisher.publisherUrl,
      url: publisher.url, sources: [publisher],
      publishedAt: text(item.pubDate) || null, publishedAtTimezone: text(item.pubDateTZ) || null,
      description: text(item.description) || text(item.content) || '',
      imageUrl: text(item.image_url) || null,
      language: text(item.language) || null,
      countries: Array.isArray(item.country) ? item.country.filter(x => typeof x === 'string') : [],
      categories: Array.isArray(item.category) ? item.category.filter(x => typeof x === 'string') : [],
      keywords: Array.isArray(item.keywords) ? item.keywords.filter(x => typeof x === 'string').slice(0,12) : [],
      authors: Array.isArray(item.creator) ? item.creator.filter(x => typeof x === 'string').slice(0,5) : [],
    });
  }
  return groups.map(({normalizedTitle,...article})=>article);
}

export class NewsDataError extends Error {
  constructor(message, code = 'upstream') { super(message); this.code = code; }
}

export class NewsDataService {
  constructor({ apiKey = process.env.NEWSDATA_API_KEY, intervalHours = process.env.NEWS_REFRESH_INTERVAL_HOURS, fetchImpl = fetch, now = () => Date.now(), retryMs = 15 * 60 * 1000, queries = SEARCHES, countries = 'my,id,sg', languages = 'en,ms', maxPages = 1, timeoutMs = 10000 } = {}) {
    this.apiKey = apiKey?.trim();
    this.queries = queries;
    this.countries = countries;
    this.languages = languages;
    this.maxPages = maxPages === 2 ? 2 : 1;
    this.timeoutMs = timeoutMs;
    const parsedHours = Number(intervalHours);
    this.intervalMs = Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours * 60 * 60 * 1000 : 3 * 60 * 60 * 1000;
    this.fetch = fetchImpl;
    this.now = now;
    this.retryMs = retryMs;
    this.cached = null;
    this.lastAttemptAt = null;
    this.inFlight = null;
  }

  snapshot({ loading = false } = {}) {
    if (!this.apiKey) return { articles: [], source: 'NewsData.io', status: 'unavailable', stale: false, updatedAt: null, error: 'NewsData.io is not configured. Add NEWSDATA_API_KEY to the server .env file.' };
    if (!this.cached) return { articles: [], source: 'NewsData.io', status: loading ? 'loading' : 'unavailable', stale: false, updatedAt: null, error: loading ? null : 'No haze-related news has been loaded yet.' };
    const hasSuccessfulRefresh = Boolean(this.cached.updatedAt);
    const age = hasSuccessfulRefresh ? this.now() - Date.parse(this.cached.updatedAt) : Infinity;
    const expired = hasSuccessfulRefresh && age >= this.intervalMs;
    const stale = expired || (hasSuccessfulRefresh && Boolean(this.cached.refreshFailed));
    const status = this.cached.refreshFailed ? (hasSuccessfulRefresh ? 'stale' : 'unavailable') : this.cached.partial ? 'partial' : expired ? 'stale' : 'ready';
    return { ...this.cached, status, stale, refreshing: Boolean(this.inFlight), error: this.cached.error || null };
  }

  async get({ waitForInitial = true } = {}) {
    if (!this.apiKey) return this.snapshot();
    const fresh = this.cached?.updatedAt && this.now() - Date.parse(this.cached.updatedAt) < this.intervalMs && !this.cached.refreshFailed;
    if (fresh) return this.snapshot();
    if (!this.inFlight && (this.lastAttemptAt === null || this.now() - this.lastAttemptAt >= this.retryMs)) this.startRefresh();
    if (waitForInitial && this.inFlight) await this.inFlight;
    return this.snapshot({ loading: Boolean(this.inFlight) });
  }

  startRefresh() {
    this.lastAttemptAt = this.now();
    this.inFlight = this.refresh().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  async request(query) {
    const url = new URL(ENDPOINT);
    url.searchParams.set('q', query);
    if (this.countries) url.searchParams.set('country', this.countries);
    if (this.languages) url.searchParams.set('language', this.languages);
    url.searchParams.set('size', '10');
    const articles = [];
    for (let page = 0; page < this.maxPages; page++) {
      let payload;
      try { payload = await this.requestPage(url); }
      catch (error) {
        if (page === 0) throw error;
        return { articles, partial: true };
      }
      articles.push(...payload.results);
      if (typeof payload.nextPage !== 'string' || !payload.nextPage) break;
      url.searchParams.set('page', payload.nextPage);
    }
    return { articles, partial: false };
  }

  async requestPage(url) {
    let response;
    try {
      response = await this.fetch(url, { method: 'GET', headers: { 'accept': 'application/json', 'X-ACCESS-KEY': this.apiKey }, signal: AbortSignal.timeout(this.timeoutMs) });
    } catch { throw new NewsDataError('Could not reach NewsData.io. Cached articles will remain available.', 'network'); }
    let payload;
    try { payload = await response.json(); }
    catch { throw new NewsDataError('NewsData.io returned invalid JSON.', 'malformed'); }
    if (!response.ok || payload.status !== 'success') {
      const textError = String(payload?.results?.message || payload?.message || payload?.results || '');
      const code = response.status === 401 || response.status === 403 ? 'invalid_key' : response.status === 429 || /rate limit/i.test(textError) ? 'rate_limit' : /credit|quota/i.test(textError) ? 'quota' : 'upstream';
      const message = code === 'invalid_key' ? 'NewsData.io did not accept the configured API key.' : code === 'rate_limit' ? 'NewsData.io rate limit reached. Cached articles will remain available.' : code === 'quota' ? 'NewsData.io request credits are exhausted. Cached articles will remain available.' : 'NewsData.io could not refresh the news feed.';
      throw new NewsDataError(message, code);
    }
    if (!Array.isArray(payload.results)) throw new NewsDataError('NewsData.io returned an incomplete or malformed response.', 'malformed');
    return payload;
  }

  async refresh() {
    const outcomes = await Promise.allSettled(this.queries.map(query => this.request(query)));
    const fulfilled = outcomes.filter(x => x.status === 'fulfilled');
    const failed = outcomes.filter(x => x.status === 'rejected');
    if (!fulfilled.length) {
      const reason = failed[0]?.reason;
      if (this.cached) {
        this.cached = { ...this.cached, error: reason instanceof Error ? reason.message : 'NewsData.io refresh failed.', refreshFailed: true };
      } else {
        this.cached = { articles: [], source: 'NewsData.io', updatedAt: null, error: reason instanceof Error ? reason.message : 'NewsData.io refresh failed.', refreshFailed: true };
      }
      return this.cached;
    }
    const articles = normalizeNewsResponse({ status: 'success', results: fulfilled.flatMap(x => x.value.articles) });
    const partial = failed.length > 0 || fulfilled.some(x => x.value.partial);
    this.cached = { articles, source: 'NewsData.io', updatedAt: new Date(this.now()).toISOString(), error: partial ? 'Some news results could not be refreshed; showing available results.' : null, partial, refreshFailed: false };
    return this.cached;
  }

  refreshIfDue() { return this.get({ waitForInitial: false }); }
}

export const newsSearches = SEARCHES;
