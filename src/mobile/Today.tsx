import { useState } from 'react';
import { CalendarClock, ChevronDown, ChevronRight, CloudSun, FileText, Info, MapPin, RefreshCw, Wind } from 'lucide-react';
import { affectedPlans, dateLabel, type Plan } from '../ui/model';
import type { AQReading } from '../core/types';
import type { HazeOutlook } from '../core/outlook';
import type { NewsFeed, NewsArticle } from '../services/news';
import { BotanicalNote, DemoNote, ExternalLink, Forecast, HazeMap, Modal, SectionTitle } from './Kit';
import { forecastDays, observationState, timestamp, todayInMalaysia, waqiTone } from './backend';

import { SpendingSummary, type SpendingsState } from './Spendings';

type Props = {
  spendings?: SpendingsState; onSpendings?: () => void;
  location: string; plans: Plan[]; onLocation: () => void; onAffected: () => void;
  reading: AQReading | null; loading: boolean; error: string; onRefresh: () => void;
  outlook?: HazeOutlook | null; outlookLoading?: boolean; outlookError?: string;
  news: NewsFeed | null; newsLoading: boolean; newsError: string; onRefreshNews: () => void;
};
const pollutantNames: Record<string, string> = { pm25: 'PM2.5', pm10: 'PM10', o3: 'O₃', no2: 'NO₂', so2: 'SO₂', co: 'CO' };

export function Today({ spendings, onSpendings, location, plans, onLocation, onAffected, reading, outlook, outlookLoading = false, outlookError = '', loading, error, onRefresh, news, newsLoading, newsError, onRefreshNews }: Props) {
  const [sources, setSources] = useState(false);
  const [hourlyDemo, setHourlyDemo] = useState(false);
  const [mapDemo, setMapDemo] = useState(false);
  const [demoCity, setDemoCity] = useState('Kuala Lumpur');
  const affected = affectedPlans(plans);
  const allForecasts = forecastDays(reading);
  const daily = allForecasts.filter(row => row.day >= todayInMalaysia());
  const outlookTitles = { easing: 'Reports suggest easing', worsening: 'Reports warn of persistent haze', mixed: 'Reports suggest a mixed outlook', unknown: 'Outlook unavailable' };
  const estimateLabel = (event: HazeOutlook['alleviation'] | undefined) => event?.expected === true ? event.timeframe?.label || 'Timing unavailable'
    : 'Cannot estimate';
  return <div className="today-page">
    <header className="location-heading"><p>{dateLabel(todayInMalaysia())}</p><button onClick={onLocation} aria-label="Change location"><MapPin size={16}/><h1>{location}</h1><ChevronDown size={16}/></button><span>Your air. Your plans. A little clarity.</span></header>
    <section className="air-card" aria-label="Current air quality" aria-busy={loading}>
      <div className="card-top"><span><Wind size={17}/>Current air quality</span><button className="icon-button" disabled={loading} onClick={onRefresh} aria-label="Refresh air quality"><RefreshCw size={17}/></button></div>
      {loading && !reading ? <p className="live-notice" role="status">Loading current conditions…</p> : error ? <div className="live-notice" role="alert"><strong>Current conditions unavailable</strong><p>{error}</p><button className="text-button" onClick={onRefresh}>Try again</button></div> : <>
        <div className="reading-main"><span className="api-number">{reading?.aqi ?? '—'}</span><div><span className="reading-unit">WAQI AQI</span><h2>{reading?.category || 'Unavailable'}</h2><span className="reading-comparison">{reading?.station || location}</span></div><span className="air-decoration" aria-hidden="true"><Wind size={52} strokeWidth={.75}/></span></div>
        <div className="waqi-scale" aria-label="WAQI AQI scale"><span/><span/><span/><span/><span/><span/>{reading?.aqi != null && <i style={{ left: Math.min(97, reading.aqi / 500 * 100) + '%' }}/>}</div><div className="scale-labels"><span>Good</span><span>Hazardous</span></div>
        <p className="demo-note"><span/>{observationState(reading?.observedAt)} · {timestamp(reading?.observedAt)}</p>
        <div className="live-pollutants">{Object.entries(pollutantNames).map(([key, label]) => <div key={key}><span>{label}</span><strong>{reading?.pollutants?.[key] ?? '—'}</strong></div>)}</div>
        <p className="fine-print">Pollutant values are WAQI individual indices, not µg/m³. Dominant pollutant: {pollutantNames[reading?.dominantPollutant || ''] || reading?.dominantPollutant || 'unavailable'}.</p>
      </>}
      <button className="text-button" onClick={() => setSources(true)}><FileText size={14}/> Data source &amp; attribution</button>
    </section>
    <button className="outlook-card" onClick={() => setSources(true)} aria-label="View haze outlook and its sources">
      <div className="card-top"><span><CloudSun size={17}/>Haze outlook</span><span className="outlook-source-link"><FileText size={13}/>Sources<ChevronRight size={13}/></span></div>
      <h2>{outlookLoading && !outlook ? 'Checking haze reports…' : outlook ? outlookTitles[outlook.trend] : 'Outlook unavailable'}</h2>
      <p>{outlook?.summary || outlookError || (outlookLoading ? 'Reading the latest haze reports from NewsData.io.' : 'An outlook could not be retrieved. Refresh current air quality to retry.')}</p>
      <div className="outlook-windows"><div><span>Possible relief</span><strong>{estimateLabel(outlook?.alleviation)}</strong></div><div><span>Another wave / worsening</span><strong>{estimateLabel(outlook?.anotherWave)}</strong></div></div>
      <span className="outlook-footnote">NewsData.io · {outlook?.status === 'estimated' ? 'Low-confidence news estimate. ' : ''}Timing comes from published reports. Missing timing and a separate incoming plume cannot be inferred.</span>
    </button>
    <section className="hourly-demo demo-map"><button className="text-button" onClick={() => setMapDemo(value => !value)} aria-expanded={mapDemo}>{mapDemo ? 'Hide' : 'Explore'} nearby map demo<ChevronDown size={15}/></button>{mapDemo && <><DemoNote>Demo map · 10 October 2026 · the backend has no nearby-station map feed</DemoNote><HazeMap selected={demoCity} onSelect={setDemoCity} located={false} onLocate={onLocation}/></>}</section>
    <button className={'affected-bar' + (!affected.length ? ' clear' : '')} onClick={onAffected}><span className="affected-icon"><CalendarClock size={20}/></span><span><strong>{affected.length ? `${affected.length} demo plans may be affected` : 'Review your demo plans'}</strong><small>Schedule uses sample readings · independent of live AQI</small></span><ChevronRight size={19}/></button>
    {spendings && onSpendings && <SpendingSummary plans={plans} state={spendings} onOpen={onSpendings}/>}
    <section className="station-card"><SectionTitle detail="Station returned by the air-quality provider">Monitoring station</SectionTitle><div className="station-summary"><MapPin size={25}/><div><strong>{reading?.station || 'Unavailable'}</strong><p>{reading?.coordinates?.lat != null && reading?.coordinates?.lon != null ? `${reading.coordinates.lat.toFixed(4)}° N, ${reading.coordinates.lon.toFixed(4)}° E` : 'Station coordinates unavailable'}</p></div></div>{reading?.stationUrl && <ExternalLink href={reading.stationUrl}>View this station on WAQI</ExternalLink>}</section>
    <section className="forecast-section"><SectionTitle detail="WAQI model forecast · daily values">The days ahead</SectionTitle>
      {daily.length ? <div className="daily-forecast">{daily.map(row => <article key={row.day + row.pollutant}><div><strong>{dateLabel(row.day, true)}</strong><span>{pollutantNames[row.pollutant] || row.pollutant.toUpperCase()}{row.pollutant === 'uvi' ? ' · UV index' : ' · forecast index'}</span></div><dl><div><dt>Min</dt><dd>{row.min}</dd></div><div><dt>Average</dt><dd>{row.avg}</dd></div><div><dt>Max</dt><dd>{row.max}</dd></div></dl></article>)}</div> : <p className="body-copy">No daily forecast returned for this station. Check again later or choose another station.</p>}
      <p className="fine-print">Forecast issue time: unavailable from this feed. Daily values are modelled and are separate from the current observation.</p>
    </section>
    <section className="hourly-demo"><button className="text-button" onClick={() => setHourlyDemo(value => !value)} aria-expanded={hourlyDemo}>{hourlyDemo ? 'Hide' : 'Explore'} hourly forecast demo<ChevronDown size={15}/></button>{hourlyDemo && <><DemoNote>Demo only · 10 October 2026 · unrelated to this station’s live data</DemoNote><div className="outlook-windows"><div><span>Demo may build from</span><strong>1 PM</strong></div><div><span>Demo may ease from</span><strong>7 PM</strong></div></div><Forecast offset={0}/></>}</section>
    <BotanicalNote>A little planning, more room for living.</BotanicalNote>
    {sources && <Modal title="Behind the outlook" onClose={() => setSources(false)}><div className="source-summary"><CloudSun size={24}/><div><strong>{reading?.station || location}</strong><span>{reading?.source || 'Air-quality source unavailable'}</span></div></div><p className="body-copy">Index: {reading?.scale || 'Unavailable'}. Observation: {timestamp(reading?.observedAt)}. WAQI AQI is separate from Malaysia’s official API/IPU.</p>
      <div className="source-status"><Info size={17}/><p>Haze outlook uses NewsData.io’s latest haze reports. A simple phrase parser looks for explicit future easing or persistent/worsening haze mentioning your location. Current air quality and the daily pollutant table are supplied separately by WAQI.</p></div>
      {outlook && <><p className="fine-print">News retrieved: {timestamp(outlook.updatedAt)}. Recent local reports checked: {outlook.articlesChecked}. Relative timing is measured from each article’s publication date.</p>{outlook.limitations.map(note => <p key={note} className="fine-print">{note}</p>)}{[...outlook.alleviation.evidence, ...outlook.anotherWave.evidence].map((item, index) => <div key={item.articleId + index}><ExternalLink href={item.url}>{item.publisher}: {item.title}</ExternalLink><p className="fine-print">{timestamp(item.publishedAt)} · {item.timeframe?.label || 'Timing not reported'}</p></div>)}</>}
      {reading?.attributions?.length ? <><SectionTitle>Provider attribution</SectionTitle>{reading.attributions.map((source, index) => <ExternalLink key={source.url + index} href={source.url}>{source.name}</ExternalLink>)}</> : <p className="fine-print">No station attribution returned.</p>}
      <ExternalLink href={reading?.stationUrl || 'https://aqicn.org/'}>World Air Quality Index Project</ExternalLink>
      <NewsContext feed={news} loading={newsLoading} error={newsError} onRefresh={onRefreshNews}/>
      <SectionTitle>Official reference</SectionTitle><ExternalLink href="https://apims.doe.gov.my/">Malaysia’s official Air Pollutant Index</ExternalLink>
    </Modal>}
  </div>;
}

function publicationTime(article: NewsArticle) {
  if (!article.publishedAt) return 'Publication date unavailable';
  const value = article.publishedAt.includes('T') ? article.publishedAt : article.publishedAt.replace(' ', 'T') + (article.publishedAtTimezone === 'UTC' ? 'Z' : '');
  // Keep an unspecified publication timezone as supplied instead of guessing the browser timezone.
  return /Z$|[+-]\d{2}:?\d{2}$/.test(value) ? timestamp(value) : article.publishedAt + (article.publishedAtTimezone ? ' ' + article.publishedAtTimezone : ' · timezone unavailable');
}

export function newsExcerpt(value: string) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= 260) return text;
  const end = text.lastIndexOf(' ', 260);
  return text.slice(0, end > 180 ? end : 260) + '…';
}

export function NewsContext({ feed, loading, error, onRefresh }: { feed: NewsFeed | null; loading: boolean; error: string; onRefresh: () => void }) {
  return <section className="news-context"><SectionTitle detail={feed?.source || 'Backend news feed'} action={<button className="icon-button" onClick={onRefresh} disabled={loading} aria-label="Refresh news"><RefreshCw size={16}/></button>}>News context</SectionTitle>
    {loading && !feed && <p className="body-copy" role="status">Loading reported updates…</p>}
    {(error || feed?.error) && <p className="live-notice" role="alert">{error || feed?.error}</p>}
    {feed && <p className="fine-print">{feed.stale || error ? 'Last available feed · stale' : feed.status === 'partial' ? 'Partial feed' : feed.status === 'unavailable' ? 'Feed unavailable' : 'Feed retrieved'} · {timestamp(feed.updatedAt)}{feed.refreshing ? ' · refreshing' : ''}</p>}
    {feed?.articles.map(article => <article className="news-source" key={article.id}><div><span className="source-meta">{article.publisher} · {publicationTime(article)}</span><h3><a href={article.url} target="_blank" rel="noreferrer">{article.title}</a></h3>{article.description && <p>{newsExcerpt(article.description)}</p>}{article.sources.length > 1 && <p className="fine-print">Also reported by {article.sources.slice(1).map((source, index) => <span key={source.url || source.name}>{index ? ', ' : ''}{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a> : source.name}</span>)}.</p>}</div></article>)}
    {!loading && !error && !feed?.articles.length && <p className="body-copy">{feed?.status === 'unavailable' ? 'News is currently unavailable.' : 'No relevant reports returned.'}</p>}
    <p className="fine-print">Reports are separate from observed air quality and official advisories. Publication time differs from feed retrieval time.</p>
  </section>;
}

export function LiveReadingBadge({ reading }: { reading: AQReading }) {
  return <span className={'api-badge ' + waqiTone(reading.aqi)}><i/>{reading.category || 'Unavailable'}<span>{reading.aqi ?? '—'}</span></span>;
}
