import { cachedOutlook } from '../../shared/outlook-cache.mjs';

const DAY = 86400000;
const ZONE = 'Asia/Kuala_Lumpur';
const dayOf = ms => new Date(ms + 8 * 3600000).toISOString().slice(0, 10);
const dayStart = day => Date.parse(day + 'T00:00:00+08:00');
const HAZE = /\b(haze|jerebu|smog)\b/i;
const FUTURE = /\b(expected|expect|forecast|likely|may|could|will|set to|dijangka|diramal|mungkin|akan)\b/i;
const EASING = /\b(ease|easing|clear|clearing|improve|improving|subside|abate|dissipate|berkurang|reda|pulih)\b/i;
const WORSENING = /\b(worsen|worsening|intensify|deteriorate|return|persist|persistent|increase|thicken|exceed|berterusan|meningkat|kembali|bertambah)\b/i;
const NEGATED = /\b(no|not|unlikely|cannot|can't|won't|wouldn't|tidak|tak|bukan)\b/i;
const RAIN = /\b(rain|rainfall|showers|thunderstorms?|hujan)\b/i;
const DRY = /\b(dry weather|dry spell|dry conditions|hotspots?|forest fires?|peat fires?|open burning|cuaca kering|kebakaran)\b/i;
const CURRENT_EASING = /\b(easing|clearing|improving|improved|subsiding|abating|relief|berkurang|reda|pulih)\b/i;
const CURRENT_WORSENING = /\b(worsening|worsened|intensifying|deteriorating|persistent|persisting|unhealthy|hazardous|berterusan|meningkat)\b/i;
const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const number = value => WORDS[value?.toLowerCase()] || Number(value);

export function publicationTime(article) {
  const value = article.publishedAt?.trim();
  if (!value) return NaN;
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) return Date.parse(value.replace(' ', 'T'));
  const zone = article.publishedAtTimezone?.trim();
  if (zone !== 'UTC' && !/^[+-]\d{2}:\d{2}$/.test(zone || '')) return NaN;
  return Date.parse(value.replace(' ', 'T') + (zone === 'UTC' ? 'Z' : zone));
}

function reportedWindow(sentence, published) {
  const day = dayStart(dayOf(published));
  let start, end, text;
  const relative = sentence.match(/\b(today|tomorrow|hari ini|esok)\b/i);
  const duration = sentence.match(/\b(in|within|over(?: the)? next|for(?: the next)?)\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s*(?:-|to|and)\s*(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten))?\s*(hours?|days?|weeks?)\b/i);
  if (relative) {
    start = day + (/tomorrow|esok/i.test(relative[0]) ? DAY : 0); end = start + DAY; text = relative[0];
  } else if (duration) {
    const unit = /^hour/i.test(duration[4]) ? 3600000 : /^week/i.test(duration[4]) ? 7 * DAY : DAY;
    const from = number(duration[2]), to = duration[3] ? number(duration[3]) : from;
    if (!from || to < from || to * unit > 14 * DAY) return null;
    const bounded = /^within|^over|^for/i.test(duration[1]);
    start = published + (bounded ? 0 : from * unit);
    end = published + to * unit + (bounded ? 0 : unit);
    text = duration[0];
  } else return null;
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString(),
    label: `${text} (reported ${new Date(published).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: ZONE })})`,
    reportedText: text, resolution: 'reported_window', timeZone: ZONE, basis: 'reported', rule: null, anchorAt: new Date(published).toISOString() };
}

const localAliases = location => /\bkuala lumpur\b/i.test(location) ? ['kuala lumpur', 'kl'] : [location.split(',')[0].trim().toLowerCase()];
function localText(text, location) {
  const words = ' ' + text.toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ';
  return localAliases(location).some(alias => words.includes(' ' + alias.replace(/[^a-z0-9]+/g, ' ').trim() + ' '));
}

const MALAYSIAN_LOCATION = /\b(malaysia|kuala lumpur|kl|selangor|petaling jaya|shah alam|subang|klang|ampang|putrajaya|cyberjaya|johor|penang|pulau pinang|george town|ipoh|perak|melaka|malacca|seremban|negeri sembilan|pahang|kuantan|kedah|alor setar|perlis|kelantan|kota bharu|terengganu|sabah|sarawak|kuching|kota kinabalu|labuan)\b/i;
const FOREIGN_CONTEXT = /\b(singapore|singapura|indonesia|jakarta|sumatra|kalimantan|thailand|bangkok|pakistan|india|china|united states)\b/i;
function malaysiaHazeReport(article) {
  const text = article.title + ' ' + (article.description || '');
  if (!HAZE.test(text) || FOREIGN_CONTEXT.test(text) || /\b(film|movie|fictional|blu[ -]?ray|album|song)\b/i.test(text)) return false;
  const nationalContext = /\b(malaysia|malaysian|education ministry|state education directors|public works department|jkr|moe|kementerian pendidikan)\b/i.test(text);
  return nationalContext && (/\b(malaysia|malaysian)\b/i.test(text)
    || article.countries?.some(country => /^(malaysia|my)$/i.test(country)));
}

// Deliberately simple planning defaults, not calibrated meteorological relationships.
export const heuristicRules = {
  rain_relief: { hours: [12, 36], reason: 'Assume possible short-term relief after reported or expected rain.', priority: 3 },
  easing_relief: { hours: [24, 48], reason: 'Assume a reported easing signal may continue over one to two days.', priority: 2 },
  dry_relief: { hours: [72, 120], reason: 'Assume dry weather or active burning may delay relief to three to five days.', priority: 3 },
  episode_relief: { hours: [48, 96], reason: 'Default assumption for a local haze episode: possible relief in two to four days.', priority: 1 },
  worsening_risk: { hours: [0, 24], reason: 'Extrapolate recent worsening into a near-term persistence or worsening risk.', priority: 2 },
  dry_risk: { hours: [0, 48], reason: 'Assume dry conditions or active burning may sustain haze risk for up to two days.', priority: 3 },
};

function heuristicWindow(ruleName, published, now) {
  const rule = heuristicRules[ruleName], hour = 3600000;
  const start = published + rule.hours[0] * hour, end = published + rule.hours[1] * hour;
  if (end <= now.getTime()) return null;
  const fromHours = Math.max(0, Math.ceil((start - now.getTime()) / hour));
  const toHours = Math.ceil((end - now.getTime()) / hour);
  const label = fromHours === 0 ? `Within ~${toHours} hours`
    : toHours <= 48 ? `Roughly ${fromHours}–${toHours} hours`
      : `Roughly ${Math.ceil(fromHours / 24)}–${Math.ceil(toHours / 24)} days`;
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString(), label,
    reportedText: null, resolution: 'heuristic_window', timeZone: ZONE, basis: 'heuristic', rule: ruleName,
    anchorAt: new Date(published).toISOString() };
}

function heuristicCandidates(articles, location, now, regional = false) {
  const candidates = { alleviation: [], anotherWave: [] };
  for (const article of articles) {
    const published = publicationTime(article);
    const titleContext = HAZE.test(article.title) && (regional || localText(article.title, location));
    const sentences = [article.title, ...(article.description || '').split(/(?<=[.!?;])\s+|\n+/)];
    for (const sentence of sentences) {
      if (NEGATED.test(sentence) || (!regional && !localText(sentence, location) && !titleContext)) continue;
      const haze = HAZE.test(sentence);
      // A weather-only sentence can be used when its headline supplies the local haze context.
      if (!haze && !titleContext) continue;
      const rain = RAIN.test(sentence) && (FUTURE.test(sentence) || CURRENT_EASING.test(sentence));
      const dry = DRY.test(sentence);
      const easing = haze && (CURRENT_EASING.test(sentence) || (FUTURE.test(sentence) && EASING.test(sentence)));
      const worsening = haze && (CURRENT_WORSENING.test(sentence) || (FUTURE.test(sentence) && WORSENING.test(sentence)));
      if (easing && worsening) continue;
      // Do not revive an explicitly dated claim after its reported window has ended.
      const explicit = reportedWindow(sentence, published);
      if (explicit && Date.parse(explicit.end) <= now.getTime()) continue;
      if (!haze && !rain && !dry) continue;
      const rules = { alleviation: rain ? 'rain_relief' : dry ? 'dry_relief' : easing ? 'easing_relief' : haze ? 'episode_relief' : null,
        anotherWave: dry ? 'dry_risk' : worsening ? 'worsening_risk' : null };
      for (const [kind, ruleName] of Object.entries(rules)) {
        if (!ruleName) continue;
        const timeframe = heuristicWindow(ruleName, published, now);
        if (!timeframe) continue;
        candidates[kind].push({ timeframe, rationale: heuristicRules[ruleName].reason,
          articleId: article.id, title: article.title, url: article.url, publisher: article.publisher,
          publishedAt: new Date(published).toISOString(), excerpt: sentence.slice(0, 600) });
      }
    }
  }
  for (const items of Object.values(candidates)) {
    items.sort((a, b) => heuristicRules[b.timeframe.rule].priority - heuristicRules[a.timeframe.rule].priority
      || Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  }
  return candidates;
}

/** Prefer reported timing; fill missing windows using explicitly labelled news-based planning defaults. */
export function estimateHazeOutlook(feed, location = 'Kuala Lumpur', now = new Date(), { allowRegional = false } = {}) {
  const base = {
    status: 'unavailable', trend: 'unknown', confidence: 'none', reason: null,
    generatedAt: now.toISOString(), source: 'NewsData.io latest haze reports', location, timeZone: ZONE,
    updatedAt: feed?.updatedAt || null, articlesChecked: 0,
    alleviation: { expected: null, timeframe: null, evidence: [], basis: null, rationale: null }, anotherWave: { expected: null, timeframe: null, evidence: [], basis: null, rationale: null },
    method: { name: 'news_haze_heuristic', query: 'haze', maximumArticleAgeHours: 48, heuristicRules },
    limitations: ['News-based estimate, not a numerical air-quality forecast or official advisory.',
      'Heuristic windows are arbitrary planning defaults, not validated weather forecasts; their confidence is very low.',
      'Reported timing takes priority. Missing timing is estimated from local haze, rain, dry-weather or worsening signals.',
      'All windows are anchored to article publication, not refreshed from request time; repeated headlines are grouped.',
      'Persistent or worsening haze is a risk signal, not proof of a separate incoming plume.'],
  };
  if (!feed || feed.stale || !['ready', 'partial'].includes(feed.status)) {
    return { ...base, reason: feed?.stale ? 'stale_news' : 'news_unavailable', summary: feed?.stale
      ? 'The news feed is stale. A current haze outlook cannot be estimated.' : feed?.error || 'Haze reports are unavailable. Please try again later.' };
  }
  const evidence = { alleviation: [], anotherWave: [] };
  const recent = (feed.articles || []).filter(article => {
    const published = publicationTime(article);
    return Number.isFinite(published) && published <= now.getTime() + 5 * 60000 && now.getTime() - published <= 48 * 3600000;
  });
  let localArticles = recent.filter(article => HAZE.test(article.title + ' ' + (article.description || ''))
    && localText(article.title + ' ' + (article.description || ''), location));
  const regional = allowRegional && !localArticles.length && MALAYSIAN_LOCATION.test(location);
  if (regional) localArticles = recent.filter(malaysiaHazeReport);
  for (const article of localArticles) {
    const published = publicationTime(article);
    const sentences = [article.title, ...(article.description || '').split(/(?<=[.!?;])\s+|\n+/)];
    for (const sentence of sentences) {
      if (!HAZE.test(sentence) || !FUTURE.test(sentence) || NEGATED.test(sentence)) continue;
      // If another location is discussed in the description, require this claim itself to name the target.
      if (!regional && !localText(sentence, location) && !localText(article.title, location)) continue;
      const easing = EASING.test(sentence), worsening = WORSENING.test(sentence);
      if (easing === worsening) continue; // Ambiguous mixed claims need a more capable parser.
      const timeframe = reportedWindow(sentence, published);
      if (timeframe && Date.parse(timeframe.end) <= now.getTime()) continue;
      const kind = easing ? 'alleviation' : 'anotherWave';
      if (evidence[kind].some(item => item.articleId === article.id)) continue;
      evidence[kind].push({ articleId: article.id, title: article.title, url: article.url, publisher: article.publisher,
        publishedAt: new Date(published).toISOString(), excerpt: sentence.slice(0, 600), timeframe });
    }
  }
  const fallback = heuristicCandidates(localArticles, location, now, regional);
  const event = (items, candidates) => {
    const reported = items.filter(item => item.timeframe).sort((a, b) => Date.parse(a.timeframe.start) - Date.parse(b.timeframe.start))[0]?.timeframe;
    const candidate = candidates[0];
    return { expected: items.length || candidate ? true : null, timeframe: reported || candidate?.timeframe || null,
      basis: items.length ? 'reported' : candidate ? 'heuristic' : null,
      rationale: reported ? 'Timing stated in a published report.' : candidate?.rationale || null,
      evidence: reported || !candidate ? items : [...items.filter(item => item.articleId !== candidate.articleId), candidate] };
  };
  const alleviation = event(evidence.alleviation, fallback.alleviation), anotherWave = event(evidence.anotherWave, fallback.anotherWave);
  const found = alleviation.expected || anotherWave.expected;
  const trend = alleviation.expected && anotherWave.expected ? 'mixed' : alleviation.expected ? 'easing' : anotherWave.expected ? 'worsening' : 'unknown';
  const inferred = [alleviation, anotherWave].some(event => event.timeframe?.basis === 'heuristic');
  const describe = (event, text) => event.expected ? `${event.timeframe?.basis === 'heuristic' ? 'Rough heuristic' : 'Reported outlook'} — ${text}${event.timeframe ? `: ${event.timeframe.label}` : '; timing unknown'}.` : '';
  return { ...base, status: found ? 'estimated' : 'unavailable', trend, confidence: found ? inferred || regional ? 'very_low' : 'low' : 'none',
    reason: found ? null : localArticles.length ? 'no_usable_signals' : 'no_recent_local_reports', articlesChecked: localArticles.length,
    newsBasis: { scope: regional ? 'malaysia' : 'local', label: regional ? 'Malaysia-wide haze reports; city-specific news was not available.' : 'Local haze reports',
      reused: false, newestArticleAt: localArticles.length ? new Date(Math.max(...localArticles.map(publicationTime))).toISOString() : null },
    alleviation, anotherWave,
    summary: found ? (regional ? 'Malaysia-wide news estimate. ' : '') + [describe(alleviation, 'possible easing'), describe(anotherWave, 'persistence or worsening risk')].filter(Boolean).join(' ')
      : localArticles.length ? 'Recent local reports contain no usable haze signals for a rough timeframe.'
        : `No recent haze reports explicitly mentioning ${location} were returned. Relief, another wave and timing cannot be estimated.`,
  };
}

/** Reuse actual source articles when no current estimate or saved prediction is available. */
export function estimateReusableHazeOutlook(feed, location = 'Kuala Lumpur', now = new Date()) {
  const current = estimateHazeOutlook(feed, location, now, { allowRegional: true });
  if (current.status === 'estimated') return current;
  const valid = (feed?.articles || []).filter(article => {
    const published = publicationTime(article);
    return Number.isFinite(published) && published <= now.getTime() && HAZE.test(article.title + ' ' + (article.description || ''));
  });
  const local = valid.filter(article => localText(article.title + ' ' + (article.description || ''), location));
  const articles = local.length ? local : MALAYSIAN_LOCATION.test(location) ? valid.filter(malaysiaHazeReport) : [];
  if (!articles.length) return current;
  const published = Math.max(...articles.map(publicationTime));
  // Reconstruct the estimate at the source's original time, never reset its bounds to today.
  const historical = estimateHazeOutlook({ ...feed, articles, status: 'ready', stale: false }, location, new Date(published), { allowRegional: true });
  if (historical.status !== 'estimated') return current;
  historical.newsBasis.reused = true;
  historical.confidence = 'very_low';
  historical.limitations.push('Previously retrieved news is reused. Original article dates and estimate windows are retained; this is not a fresh forecast.');
  return cachedOutlook({ outlook: historical, news: feed }, 'reused_news', now).outlook;
}
