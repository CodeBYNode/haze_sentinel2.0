import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Today, newsExcerpt } from './Today';
import type { AQReading } from '../core/types';
import type { HazeOutlook } from '../core/outlook';

const base = { location: 'Station A', plans: [], onLocation() {}, onAffected() {}, loading: false, error: '', onRefresh() {}, news: null, newsLoading: false, newsError: '', onRefreshNews() {} };

describe('Today backend rendering', () => {
  it('renders provider categories, measurements and daily forecasts instead of sample API', () => {
    const reading: AQReading = { demo: false, aqi: 123, category: 'Unhealthy for Sensitive Groups', scale: 'WAQI AQI scale', station: 'Station A', observedAt: '2026-10-11T00:00:00+08:00', pollutants: { pm25: 88 }, forecast: { pm25: [{ day: '2099-10-12', min: 13, avg: 25, max: 49 }] } };
    const html = renderToStaticMarkup(<Today {...base} reading={reading}/>);
    expect(html).toContain('123');
    expect(html).toContain('Unhealthy for Sensitive Groups');
    expect(html).toContain('The days ahead');
    expect(html).toContain('not µg/m³');
    expect(html).not.toContain('Malaysian API');
    expect(html).not.toContain('Illustrative prediction');
    expect(html).not.toContain('Bernama');
  });

  it('keeps failed live data visibly unavailable while retaining the optional hourly demo', () => {
    const html = renderToStaticMarkup(<Today {...base} reading={null} error="AQICN quota reached"/>);
    expect(html).toContain('AQICN quota reached');
    expect(html).toContain('Outlook unavailable');
    expect(html).toContain('hourly forecast demo');
    expect(html).not.toContain('12 PM MYT');
  });

  it('limits news excerpts without losing the publisher link', () => {
    expect(newsExcerpt('word '.repeat(500)).length).toBeLessThanOrEqual(261);
  });

  it('displays processed relief and worsening windows separately', () => {
    const outlook = { status: 'estimated', trend: 'mixed', summary: 'Possible easing then renewed worsening.',
      alleviation: { expected: true, timeframe: { label: 'Tomorrow, 12 Oct' } }, anotherWave: { expected: true, timeframe: { label: '14 Oct' } },
      method: { name: 'news_haze_heuristic' } } as HazeOutlook;
    const html = renderToStaticMarkup(<Today {...base} reading={null} outlook={outlook}/>);
    expect(html).toContain('Reports suggest a mixed outlook'); expect(html).toContain('Tomorrow, 12 Oct'); expect(html).toContain('14 Oct');
    expect(html).toContain('Low-confidence news estimate'); expect(html).toContain('Possible relief');
  });
  it('explains insufficient news without claiming no incoming wave', () => {
    const outlook = { status: 'unavailable', trend: 'unknown', summary: 'Recent reports do not provide an explicit future outlook.',
      alleviation: { expected: null, timeframe: null }, anotherWave: { expected: null, timeframe: null } } as HazeOutlook;
    const html = renderToStaticMarkup(<Today {...base} reading={null} outlook={outlook}/>);
    expect(html).toContain('explicit future outlook'); expect(html).toContain('Cannot estimate'); expect(html).not.toContain('No signal in forecast');
  });
  it('labels imposed timeframes as a rough estimate with very low confidence', () => {
    const outlook = { status: 'estimated', trend: 'mixed', confidence: 'very_low', summary: 'Rough heuristic — possible easing.',
      alleviation: { expected: true, timeframe: { label: 'Roughly 2–4 days', basis: 'heuristic' } },
      anotherWave: { expected: true, timeframe: { label: 'Within ~12 hours', basis: 'heuristic' } } } as HazeOutlook;
    const html = renderToStaticMarkup(<Today {...base} reading={null} outlook={outlook}/>);
    expect(html).toContain('Rough haze outlook'); expect(html).toContain('Very low confidence');
    expect(html).toContain('Roughly 2–4 days'); expect(html).toContain('Within ~12 hours');
    expect(html).not.toContain('Reports suggest a mixed outlook');
  });
});
