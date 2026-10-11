export const AGE_GROUPS = [
  { value: 'under-18', label: 'Under 18', detail: 'More cautious advice for children and teenagers.' },
  { value: '18-64', label: '18–64', detail: 'General haze guidance, with health conditions considered separately.' },
  { value: '65-plus', label: '65+', detail: 'More cautious advice for older adults.' },
  { value: 'prefer', label: 'Prefer not to say', detail: 'Use general guidance without an age assumption.' },
];
export function normalizeAgeGroup(value) {
  if (['under-5', '5-17'].includes(value)) return 'under-18';
  return AGE_GROUPS.some(group => group.value === value) ? value : 'prefer';
}
export function ageSensitivity(value) {
  const ageGroup = normalizeAgeGroup(value), extra = ['under-18', '65-plus'].includes(ageGroup);
  return { ageGroup, extraCaution: extra,
    label: extra ? 'More cautious haze guidance' : ageGroup === 'prefer' ? 'Age not disclosed' : 'General haze guidance',
    explanation: extra ? 'This age group can be more sensitive to haze. We suggest shorter, gentler outdoor activities and indoor alternatives sooner.'
      : ageGroup === 'prefer' ? 'No age-related sensitivity is assumed. General advice still accounts for the available air-quality data.'
        : 'Age alone adds no extra caution. Existing health conditions and the air quality still matter.' };
}
/** Tailor advice, never the measured AQI or a person's overall health status. */
export function ageActivityGuidance(value, reading, now = Date.now()) {
  const sensitivity = ageSensitivity(value), time = Date.parse(reading?.observedAt || '');
  const available = !reading?.demo && typeof reading?.aqi === 'number' && Number.isFinite(reading.aqi) && reading.aqi >= 0
    && Number.isFinite(time) && time <= now + 5 * 60000 && now - time <= 2 * 3600000;
  if (!available) return { ...sensitivity, readingAvailable: false,
    advice: 'Current conditions cannot be assessed from a fresh reading. Check updated air quality before heading out.',
    outdoorSuggestion: sensitivity.extraCaution ? 'Consider a gentle indoor activity while current conditions are unavailable.' : 'Keep an indoor alternative available until conditions can be checked.' };
  const extra = sensitivity.extraCaution, aqi = reading.aqi;
  const advice = aqi <= 50 ? extra ? 'Choose shorter, gentler outdoor activities, take breaks and watch for discomfort.' : 'Normal outdoor activity is generally reasonable; take breaks and stop if you feel unwell.'
    : aqi <= 100 ? extra ? 'Keep outdoor activity short and gentle. Avoid prolonged or strenuous exercise and consider going indoors.' : 'Choose lower-intensity activity and reduce prolonged outdoor exertion if you feel discomfort.'
      : aqi <= 150 ? extra ? 'Prefer indoor exercise or postpone strenuous outdoor activity. Keep essential outdoor trips short.' : 'Reduce prolonged or strenuous outdoor exercise and consider an indoor alternative.'
        : 'Avoid strenuous outdoor exercise. Prefer indoor activity and reduce time outside.';
  return { ...sensitivity, readingAvailable: true, advice,
    outdoorSuggestion: aqi > 150 || extra && aqi > 100 ? 'Try gentle indoor stretching or walking in a space with cleaner air.'
      : extra || aqi > 50 ? 'Choose a short, easy walk rather than a long run; move indoors if conditions worsen.'
        : 'Keep activity comfortable and recheck air quality before a longer session.' };
}
