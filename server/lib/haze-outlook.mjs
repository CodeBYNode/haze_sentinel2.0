const DAY = 86400000;
const ZONE = 'Asia/Kuala_Lumpur';
const dayOf = ms => new Date(ms + 8 * 3600000).toISOString().slice(0, 10);
const dayStart = day => Date.parse(day + 'T00:00:00+08:00');
const HAZE = /\b(haze|jerebu|smog)\b/i;
const FUTURE = /\b(expected|expect|forecast|likely|may|could|will|set to|dijangka|diramal|mungkin|akan)\b/i;
const EASING = /\b(ease|easing|clear|clearing|improve|improving|subside|abate|dissipate|berkurang|reda|pulih)\b/i;
const WORSENING = /\b(worsen|worsening|intensify|deteriorate|return|persist|persistent|increase|thicken|exceed|berterusan|meningkat|kembali|bertambah)\b/i;
const NEGATED = /\b(not|unlikely|no longer|cannot|can't|won't|wouldn't|tidak|tak|bukan)\b/i;
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
    reportedText: text, resolution: 'reported_window', timeZone: ZONE };
}

const localAliases = location => /\bkuala lumpur\b/i.test(location) ? ['kuala lumpur', 'kl'] : [location.split(',')[0].trim().toLowerCase()];
function localText(text, location) {
  const words = ' ' + text.toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ';
  return localAliases(location).some(alias => words.includes(' ' + alias.replace(/[^a-z0-9]+/g, ' ').trim() + ' '));
}

/** Extract explicit forward-looking haze claims; absence of a claim is unknown, never false. */
export function estimateHazeOutlook(feed, location = 'Kuala Lumpur', now = new Date()) {
  const base = {
    status: 'unavailable', trend: 'unknown', confidence: 'none', reason: null,
    generatedAt: now.toISOString(), source: 'NewsData.io latest haze reports', location, timeZone: ZONE,
    updatedAt: feed?.updatedAt || null, articlesChecked: 0,
    alleviation: { expected: null, timeframe: null, evidence: [] }, anotherWave: { expected: null, timeframe: null, evidence: [] },
    method: { name: 'reported_haze_trend', query: 'haze', maximumArticleAgeHours: 48 },
    limitations: ['News-based estimate, not a numerical air-quality forecast or official advisory.',
      'Only explicit future haze statements mentioning the selected location are used; unsupported languages and phrasing may be missed.',
      'Timing is resolved from article publication, not request time. Missing timing stays unknown; repeated headlines are grouped.',
      'Persistent or worsening haze is a risk signal, not proof of a separate incoming plume.'],
  };
  if (!feed || feed.stale || !['ready', 'partial'].includes(feed.status)) {
    return { ...base, reason: feed?.stale ? 'stale_news' : 'news_unavailable', summary: feed?.stale
      ? 'The news feed is stale. A current haze outlook cannot be estimated.' : feed?.error || 'Haze reports are unavailable. Please try again later.' };
  }
  const evidence = { alleviation: [], anotherWave: [] };
  const localArticles = (feed.articles || []).filter(article => {
    const published = publicationTime(article);
    return Number.isFinite(published) && published <= now.getTime() + 5 * 60000 && now.getTime() - published <= 48 * 3600000
      && localText(article.title + ' ' + article.description, location);
  });
  for (const article of localArticles) {
    const published = publicationTime(article);
    const sentences = [article.title, ...(article.description || '').split(/(?<=[.!?;])\s+|\n+/)];
    for (const sentence of sentences) {
      if (!HAZE.test(sentence) || !FUTURE.test(sentence) || NEGATED.test(sentence)) continue;
      // If another location is discussed in the description, require this claim itself to name the target.
      if (!localText(sentence, location) && !localText(article.title, location)) continue;
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
  const event = items => ({ expected: items.length ? true : null,
    timeframe: items.filter(item => item.timeframe).sort((a, b) => Date.parse(a.timeframe.start) - Date.parse(b.timeframe.start))[0]?.timeframe || null,
    evidence: items });
  const alleviation = event(evidence.alleviation), anotherWave = event(evidence.anotherWave);
  const found = alleviation.expected || anotherWave.expected;
  const trend = alleviation.expected && anotherWave.expected ? 'mixed' : alleviation.expected ? 'easing' : anotherWave.expected ? 'worsening' : 'unknown';
  const describe = (event, text) => event.expected ? `${text}${event.timeframe ? `: ${event.timeframe.label}` : '; timing not reported'}.` : '';
  return { ...base, status: found ? 'estimated' : 'unavailable', trend, confidence: found ? 'low' : 'none',
    reason: found ? null : localArticles.length ? 'no_explicit_outlook' : 'no_recent_local_reports', articlesChecked: localArticles.length,
    alleviation, anotherWave,
    summary: found ? [describe(alleviation, 'Reports suggest possible easing'), describe(anotherWave, 'Reports suggest persistent or worsening haze')].filter(Boolean).join(' ')
      : localArticles.length ? 'Recent local haze reports do not provide an explicit future outlook. Relief, another wave and timing cannot be estimated.'
        : `No recent haze reports explicitly mentioning ${location} were returned. Relief, another wave and timing cannot be estimated.`,
  };
}
