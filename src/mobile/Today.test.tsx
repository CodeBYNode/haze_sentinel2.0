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
      coverage: { through: '2026-10-14' }, method: { pollutant: 'pm25' } } as HazeOutlook;
    const html = renderToStaticMarkup(<Today {...base} reading={null} outlook={outlook}/>);
    expect(html).toContain('Easing and worsening ahead'); expect(html).toContain('Tomorrow, 12 Oct'); expect(html).toContain('14 Oct');
    expect(html).toContain('Low-confidence daily estimate'); expect(html).toContain('Possible relief');
  });
  it('explains stale forecasts without claiming no incoming wave', () => {
    const outlook = { status: 'unavailable', trend: 'unknown', summary: 'The particulate forecast is outdated (latest 3 Oct).',
      alleviation: { expected: null, timeframe: null }, anotherWave: { expected: null, timeframe: null } } as HazeOutlook;
    const html = renderToStaticMarkup(<Today {...base} reading={null} outlook={outlook}/>);
    expect(html).toContain('latest 3 Oct'); expect(html).toContain('Cannot estimate'); expect(html).not.toContain('No signal in forecast');
  });
});
