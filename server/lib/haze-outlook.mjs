const DAY = 86400000;
const TIME_ZONE = 'Asia/Kuala_Lumpur';
const dayOf = date => new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10);
const shiftDay = (day, count) => new Date(Date.parse(day + 'T00:00:00Z') + count * DAY).toISOString().slice(0, 10);
const validIndex = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const threshold = baseline => Math.max(10, baseline * 0.2);
const dateLabel = day => new Date(day + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const windowFor = (day, today) => ({
  date: day, start: day + 'T00:00:00+08:00', end: shiftDay(day, 1) + 'T00:00:00+08:00',
  label: (day === shiftDay(today, 1) ? 'Tomorrow, ' : '') + dateLabel(day),
  resolution: 'day', timeZone: TIME_ZONE,
});

/** A daily particulate-index trend heuristic, not a plume-arrival or hourly weather model. */
export function estimateHazeOutlook(reading, now = new Date()) {
  const today = dayOf(now), horizon = shiftDay(today, 7);
  const series = ['pm25', 'pm10'].map(pollutant => ({ pollutant, rows: Array.isArray(reading?.forecast?.[pollutant])
    ? reading.forecast[pollutant].filter(row => row && validDay(row.day) && validIndex(row.avg))
      .sort((a, b) => a.day.localeCompare(b.day)).filter((row, i, rows) => i === 0 || row.day !== rows[i - 1].day)
    : [] }));
  const latestForecastDay = series.flatMap(s => s.rows.map(row => row.day)).sort().at(-1) || null;
  const observed = typeof reading?.observedAt === 'string' && /(?:Z|[+-]\d{2}:?\d{2})$/.test(reading.observedAt)
    ? Date.parse(reading.observedAt) : NaN;
  const freshObservation = Number.isFinite(observed) && now.getTime() - observed <= 2 * 3600000 && observed <= now.getTime() + 5 * 60000;
  const candidates = series.map(s => {
    const rows = s.rows.filter(row => row.day >= today && row.day <= horizon);
    const todayRow = rows.find(row => row.day === today);
    const current = reading?.pollutants?.[s.pollutant];
    const baseline = todayRow ? { value: todayRow.avg, source: 'today_forecast', day: today }
      : freshObservation && validIndex(current) ? { value: current, source: 'current_observation', day: today } : null;
    return { ...s, rows, baseline, future: rows.filter(row => row.day > today) };
  });
  // Prefer PM2.5, but use PM10 if it is the only particulate series with a usable outlook.
  const selected = candidates.find(s => s.baseline && s.future.length);
  const base = {
    status: 'unavailable', trend: 'unknown', confidence: 'none', generatedAt: now.toISOString(),
    observedAt: reading?.observedAt || null, station: reading?.station || null,
    source: 'WAQI daily particulate forecast', latestForecastDay, timeZone: TIME_ZONE,
    alleviation: { expected: null, timeframe: null }, anotherWave: { expected: null, timeframe: null },
    coverage: null, daily: [],
    method: { name: 'daily_particulate_trend', relativeChange: 0.2, minimumIndexChange: 10, maximumHorizonDays: 7, pollutant: null, baseline: null },
    limitations: [
      'A simple estimate with low confidence; forecast issue time is unavailable from this feed.',
      'Daily averages cannot predict exact hours, sustained relief, or the arrival of a physical haze plume.',
      'Another wave means a forecast increase in particulate index, not a confirmed incoming haze plume.',
    ],
  };
  if (!selected) {
    const stale = latestForecastDay && latestForecastDay < today;
    const missingBaseline = candidates.some(s => s.future.length && !s.baseline);
    return { ...base, reason: stale ? 'stale_forecast' : missingBaseline ? 'missing_baseline' : 'missing_future_forecast',
      summary: stale ? `The particulate forecast is outdated (latest ${dateLabel(latestForecastDay)}). Relief and another wave cannot be estimated.`
        : missingBaseline ? 'A future forecast exists, but there is no same-pollutant baseline for estimating a change.'
          : 'No usable future particulate forecast is available. Relief and another wave cannot be estimated.' };
  }
  let low = selected.baseline.value, high = low, relief = null, wave = null;
  for (const row of selected.future) {
    if (!relief && high - row.avg >= threshold(high)) relief = windowFor(row.day, today);
    if (!wave && row.avg - low >= threshold(low)) wave = windowFor(row.day, today);
    low = Math.min(low, row.avg); high = Math.max(high, row.avg);
  }
  const through = selected.future.at(-1).day;
  const trend = relief && wave ? 'mixed' : relief ? 'easing' : wave ? 'worsening' : 'steady';
  const summary = [relief && `Possible easing on ${dateLabel(relief.date)}.`, wave && `Possible renewed worsening on ${dateLabel(wave.date)}.`].filter(Boolean).join(' ')
    || `No significant easing or worsening signal in the available daily forecast through ${dateLabel(through)}.`;
  return { ...base, status: 'estimated', trend, confidence: 'low', reason: null, summary,
    alleviation: { expected: Boolean(relief), timeframe: relief }, anotherWave: { expected: Boolean(wave), timeframe: wave },
    coverage: { from: today, through, forecastDays: selected.future.map(row => row.day) },
    daily: selected.rows.map(row => ({ day: row.day, averageIndex: row.avg })),
    method: { ...base.method, pollutant: selected.pollutant, baseline: selected.baseline },
  };
}
