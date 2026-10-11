export const outlookLocationKey = location => location.trim().toLowerCase().replace(/\s+/g, ' ');

export function isOutlookResponse(value) {
  const outlook = value?.outlook;
  return Boolean(outlook && ['estimated', 'unavailable'].includes(outlook.status)
    && ['easing', 'worsening', 'mixed', 'unknown'].includes(outlook.trend)
    && typeof outlook.summary === 'string' && typeof outlook.location === 'string'
    && Number.isFinite(Date.parse(outlook.generatedAt)) && Array.isArray(outlook.limitations)
    && [outlook.alleviation, outlook.anotherWave].every(event => event
      && [true, null].includes(event.expected) && Array.isArray(event.evidence)
      && (!event.timeframe || (Number.isFinite(Date.parse(event.timeframe.start))
        && Number.isFinite(Date.parse(event.timeframe.end)) && typeof event.timeframe.label === 'string')))
    && Array.isArray(value.news?.articles));
}

export function hasUsableOutlook(value, location) {
  return isOutlookResponse(value) && value.outlook.status === 'estimated'
    && outlookLocationKey(value.outlook.location) === outlookLocationKey(location)
    && [value.outlook.alleviation, value.outlook.anotherWave].some(event => event.expected === true);
}

const dateLabel = value => new Intl.DateTimeFormat('en-MY', {
  day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur',
}).format(new Date(value));

// Keep the original bounds. A cached "within 12 hours" must never become a new 12-hour forecast.
export function cachedOutlook(value, reason = 'refresh_pending', now = new Date()) {
  const original = value.outlook;
  const event = item => ({ ...item, timeframe: item.timeframe ? {
    ...item.timeframe,
    label: `${dateLabel(item.timeframe.start)} – ${dateLabel(item.timeframe.end)} MYT${Date.parse(item.timeframe.end) <= now.getTime() ? ' (window ended)' : ''}`,
  } : null });
  const alleviation = event(original.alleviation), anotherWave = event(original.anotherWave);
  const describe = (item, label) => item.expected ? `${label}: ${item.timeframe?.label || 'timing was not reported'}.` : '';
  return { outlook: { ...original, alleviation, anotherWave,
    summary: `Last saved estimate. ${[describe(alleviation, 'Possible relief'), describe(anotherWave, 'Persistence or worsening risk')].filter(Boolean).join(' ')}`,
    cache: { status: 'cached', savedAt: original.cache?.savedAt || original.generatedAt, servedAt: now.toISOString(), reason },
  }, news: { ...value.news, stale: true, status: 'stale' } };
}
