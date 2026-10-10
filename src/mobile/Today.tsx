import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, CalendarClock, ChevronDown, ChevronRight, CloudSun, FileText, Info, MapPin, MoveUpRight, Wind } from 'lucide-react';
import { affectedPlans, dateLabel, forecast, locations, severity, severityNames, TODAY, type Plan } from '../ui/model';
import { BotanicalNote, DemoNote, ExternalLink, Forecast, HazeMap, Modal, SectionTitle } from './Kit';

export function Today({ location, plans, onLocation, onAffected, onLocate, available }: { location: string; plans: Plan[]; onLocation: () => void; onAffected: () => void; onLocate: () => void; available: boolean }) {
  const [sources, setSources] = useState(false);
  const [mapSelected, setMapSelected] = useState(location);
  const reading = locations.find(l => l.name === location) || locations[0];
  const outlook = forecast.map(f => ({ ...f, api: f.api + reading.offset }));
  const firstHigher = outlook.find(f => f.api > 100);
  const peakIndex = outlook.reduce((best, f, i) => f.api > outlook[best].api ? i : best, 0);
  const relief = outlook.slice(peakIndex + 1).find(f => f.api <= 100);
  const affected = affectedPlans(plans);
  return <div className="today-page">
    <header className="location-heading"><p>{dateLabel(TODAY)}</p><button onClick={onLocation} aria-label="Change location"><MapPin size={16}/><h1>{location}</h1><ChevronDown size={16}/></button><span>Your air. Your plans. A little clarity.</span></header>
    <section className="air-card" aria-label="Current air quality">
      <div className="card-top"><span><Wind size={17}/>Current air quality</span><span className="reading-time">12 PM MYT</span></div>
      <div className="reading-main"><span className="api-number">{available ? reading.api : '—'}</span><div><span className="reading-unit">Malaysian API</span><h2>{available ? severityNames[severity(reading.api)] : 'Unavailable'}</h2><span className="reading-comparison">{available ? 'A view of the air around you' : 'Connect an air-quality provider'}</span></div><span className="air-decoration" aria-hidden="true"><Wind size={52} strokeWidth={.75}/></span></div>
      <div className="api-scale" aria-label="Malaysian API scale"><span/><span/><span/><span/><span/>{available && <i style={{ left: Math.min(97, reading.api / 350 * 100) + '%' }}/>}</div><div className="scale-labels"><span>Good</span><span>Hazardous</span></div>
      <DemoNote>{available ? 'Demo reading · not a live observation' : 'Live data unavailable'}</DemoNote>
    </section>
    <button className="outlook-card" onClick={() => setSources(true)} aria-label="View haze prediction and its sources">
      <div className="card-top"><span><CloudSun size={17}/>Haze outlook</span><span className="outlook-source-link"><FileText size={13}/>Sources<ChevronRight size={13}/></span></div>
      {available ? <><div className="outlook-windows"><div><span><MoveUpRight size={14}/>{reading.api > 100 ? 'Higher haze' : 'May build from'}</span><strong>{reading.api > 100 ? 'Now' : firstHigher?.time || 'No window'}</strong></div><div><span><ArrowDownRight size={15}/>May ease from</span><strong>{relief?.time || 'Not yet known'}</strong></div></div><p>Plan a little ahead. See what informs this outlook.</p></> : <><h2>Timing isn’t available yet.</h2><p>Open sources to see the connection status.</p></>}
      <span className="outlook-footnote">Illustrative prediction</span>
    </button>
    <button className={'affected-bar' + (!affected.length ? ' clear' : '')} onClick={onAffected}><span className="affected-icon"><CalendarClock size={20}/></span><span><strong>{affected.length ? `${affected.length} plans may be affected` : 'Your plans have breathing room'}</strong><small>{affected.length ? affected.map(p => p.title).join(' & ') : 'Review your upcoming activities'}</small></span><ChevronRight size={19}/></button>
    {available ? <><HazeMap selected={mapSelected} onSelect={setMapSelected} located={false} onLocate={onLocate}/><Forecast offset={reading.offset}/></> : <section className="empty-card"><Wind size={25}/><h2>A clearer picture is on its way.</h2><p>Nearby readings and forecasts will appear when a data source is connected.</p><ExternalLink href="https://apims.doe.gov.my/">Check official air quality</ExternalLink></section>}
    <BotanicalNote>A little planning, more room for living.</BotanicalNote>
    {sources && <Modal title="Behind the outlook" onClose={() => setSources(false)}><div className="source-summary"><CloudSun size={24}/><div><strong>{location}</strong><span>{available ? 'Illustrative outlook · 10 October 2026' : 'Prediction service not connected'}</span></div></div><p className="body-copy">{available ? 'The arrival and relief times come from the demo hourly API curve. News retrieval and a live prediction model are not connected.' : 'No current readings, news feed, or prediction model is connected. An arrival or relief time cannot be determined.'}</p><div className="source-status"><Info size={17}/><p>The reporting below is background context. It was not used to calculate today’s demo timing.</p></div><SectionTitle detail="Original publication dates are shown">News context</SectionTitle>
      <a className="news-source" href="https://www.bernama.com/en/region/news.php?id=2596384" target="_blank" rel="noreferrer"><span className="publisher-mark">B</span><div><span className="source-meta">Bernama · 19 Aug 2026</span><h3>MetMalaysia: Haze eases for now but could return soon</h3><p>Reporting on weather conditions and haze variability.</p></div><ArrowUpRight size={17}/></a>
      <a className="news-source" href="https://www.bernama.com/en/news.php?id=2443001" target="_blank" rel="noreferrer"><span className="publisher-mark">B</span><div><span className="source-meta">Bernama · 9 Jul 2025</span><h3>Open burning and monsoon haze</h3><p>Background reporting on regional haze drivers.</p></div><ArrowUpRight size={17}/></a>
      <SectionTitle>Official reference</SectionTitle><ExternalLink href="https://www.doe.gov.my/en/api-2/">Malaysia’s Air Pollutant Index</ExternalLink><p className="fine-print">News can provide context. Reliable timing also needs current observations and atmospheric forecasts.</p>
    </Modal>}
  </div>;
}
