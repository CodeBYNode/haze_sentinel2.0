import { WaqiService, WaqiError } from './waqi.mjs';
import { NewsDataService } from './newsdata.mjs';
import { assessTomorrow } from './assessment.mjs';
import { chatWithOpenRouter, OpenRouterError } from './openrouter.mjs';
import { normalizeAgeGroup, ageActivityGuidance } from '../../shared/age-guidance.mjs';

const BODY_LIMIT = 160000;
const send = (res, status, payload, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers });
  res.end(JSON.stringify(payload));
};
const safeProfile = p => ({
  ageGroup: normalizeAgeGroup(p?.ageGroup),
  health: Array.isArray(p?.health) ? p.health.filter(x => ['pregnant', 'disability', 'asthma', 'lung', 'heart'].includes(x)) : [],
  otherConsideration: Boolean(String(p?.other || '').trim()),
  location: String(p?.location || '').trim().slice(0, 120),
});
const coordinate = value => value == null || value === '' || !Number.isFinite(Number(value)) ? undefined : Number(value);

async function readBody(req) {
  // Vercel may already have parsed JSON; the standalone server supplies a stream.
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? String(req.body) : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > BODY_LIMIT) throw new Error('body-limit');
    return JSON.parse(raw);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > BODY_LIMIT) throw new Error('body-limit');
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export function createChatHandler({ waqi = new WaqiService(), news = new NewsDataService(), chat = chatWithOpenRouter, tomorrow = false } = {}) {
  return async (req, res) => {
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' }, { allow: 'POST' });
    let body;
    try { body = await readBody(req); }
    catch { return send(res, 400, { error: 'Request body must be valid JSON and under 160 KB.' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return send(res, 400, { error: 'Request body must be a JSON object.' });
    const messages = Array.isArray(body.messages) ? body.messages.filter(m => ['user', 'assistant'].includes(m?.role) && typeof m.content === 'string' && m.content.trim()).slice(-12) : [];
    if (!messages.some(m => m.role === 'user')) return send(res, 400, { error: 'Write a question before sending.' });

    try {
      const profile = safeProfile(body.profile);
      const where = { stationId: String(body.stationId || ''), lat: coordinate(body.lat), lon: coordinate(body.lon), location: profile.location };
      let reading = null, dataError = null;
      try { reading = await waqi.feed(where); }
      catch (error) { dataError = error instanceof WaqiError ? error.message : 'Air-quality service unavailable.'; }
      const assessment = assessTomorrow(reading, profile);
      // Only use available news. News-provider requests must not delay chat replies.
      const snapshot = news.snapshot();
      const context = {
        selected_location: profile.location,
        current_observation: reading ? { aqi: reading.aqi, category: reading.category, index_name: reading.indexName, observed_at: reading.observedAt, station: reading.station, pollutants: reading.pollutants, pollutant_units: 'WAQI individual pollutant AQI indices; not µg/m³', source: reading.source } : null,
        tomorrow_assessment: assessment,
        provider_error: dataError,
        news: {
          source: snapshot.source, status: snapshot.status, stale: snapshot.stale, updated_at: snapshot.updatedAt, error: snapshot.error,
          interpretation_note: 'Articles are reports, not verified measurements or official advisories. Syndicated versions are grouped and do not count as independent confirmation.',
          articles: snapshot.articles.slice(0, 8).map(a => ({ title: a.title, publisher: a.publisher, published_at: a.publishedAt, description: a.description, url: a.url, sources: a.sources })),
        },
        personal_context: { age_group: profile.ageGroup, disclosed_factors: profile.health, other_consideration_disclosed: profile.otherConsideration },
        age_activity_guidance: ageActivityGuidance(profile.ageGroup, reading),
      };
      try {
        const reply = await chat({ messages, context, language: body.language });
        return send(res, 200, tomorrow ? { assessment, reading, error: dataError, explanation: reply } : { reply, assessment, reading, dataError });
      } catch (error) {
        const message = error instanceof OpenRouterError ? error.message : 'AI service unavailable. Please retry.';
        if (tomorrow) return send(res, 200, { assessment, reading, error: dataError, explanation: null, explanationError: message });
        return send(res, error instanceof OpenRouterError ? error.status : 502, { error: message });
      }
    } catch {
      return send(res, 500, { error: 'HazeAI encountered an unexpected server error. Please retry.' });
    }
  };
}
