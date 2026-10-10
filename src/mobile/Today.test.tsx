import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Today, newsExcerpt } from './Today';
import type { AQReading } from '../core/types';

const base = { location: 'Station A', plans: [], onLocation() {}, onAffected() {}, loading: false, error: '', onRefresh() {}, news: null, newsLoading: false, newsError: '', onRefreshNews() {} };

describe('Today backend rendering', () => {
  it('renders provider categories, measurements and daily forecasts instead of sample API', () => {
    const reading: AQReading = { demo: false, aqi: 123, category: 'Unhealthy for Sensitive Groups', scale: 'WAQI AQI scale', station: 'Station A', observedAt: '2026-10-11T00:00:00+08:00', pollutants: { pm25: 88 }, forecast: { pm25: [{ day: '2099-10-12', min: 13, avg: 25, max: 49 }] } };
    const html = renderToStaticMarkup(<Today {...base} reading={reading}/>);
    expect(html).toContain('123');
    expect(html).toContain('Unhealthy for Sensitive Groups');
    expect(html).toContain('Daily forecast available');
    expect(html).toContain('not µg/m³');
    expect(html).not.toContain('Malaysian API');
    expect(html).not.toContain('Illustrative prediction');
    expect(html).not.toContain('Bernama');
  });

  it('keeps failed live data visibly unavailable while retaining the optional hourly demo', () => {
    const html = renderToStaticMarkup(<Today {...base} reading={null} error="AQICN quota reached"/>);
    expect(html).toContain('AQICN quota reached');
    expect(html).toContain('Forecast unavailable');
    expect(html).toContain('hourly forecast demo');
    expect(html).not.toContain('12 PM MYT');
  });

  it('limits news excerpts without losing the publisher link', () => {
    expect(newsExcerpt('word '.repeat(500)).length).toBeLessThanOrEqual(261);
  });
});
