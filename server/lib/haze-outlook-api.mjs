import { NewsDataService } from './newsdata.mjs';
import { estimateHazeOutlook } from './haze-outlook.mjs';

export const createHazeNewsService = options => new NewsDataService({ ...options, queries: ['haze'], countries: null, languages: null });
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers });
  res.end(JSON.stringify(body));
};

export function createHazeOutlookHandler({ news = createHazeNewsService(), now = () => new Date() } = {}) {
  return async (req, res) => {
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.' }, { allow: 'GET' });
    let location;
    try { location = new URL(req.url || '/', 'http://localhost').searchParams.get('location')?.trim() || 'Kuala Lumpur'; }
    catch { return send(res, 400, { error: 'Invalid request URL.' }); }
    if (!/^[a-z0-9 .,'()-]{2,100}$/i.test(location)) return send(res, 400, { error: 'Provide a valid location name.' });
    try {
      const feed = await news.get();
      return send(res, 200, { outlook: estimateHazeOutlook(feed, location, now()), news: feed });
    } catch { return send(res, 502, { error: 'Haze news could not be processed. Please try again later.' }); }
  };
}
