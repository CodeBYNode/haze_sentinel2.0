import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowRight, Check, ChevronDown, Compass, Info, LocateFixed, MapPin, Minus, Plus, Wind, X } from 'lucide-react';
import { forecast, locations, severity, severityNames, type Severity } from './model';

export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={'brand' + (compact ? ' compact' : '')}><span className="brand-symbol"><Wind size={24} strokeWidth={1.7}/><i/></span><span>haze<span className="brand-sentinel">sentinel</span><small>A little clarity for your day.</small></span></div>;
}
export function Badge({ api, indoor = false, small = false }: { api: number; indoor?: boolean; small?: boolean }) {
  const s = severity(api);
  return <span className={'severity-badge ' + s + (small ? ' small' : '')}><span className="severity-dot"/>{indoor ? 'Indoor' : severityNames[s]}{!small && !indoor && <span className="badge-value">{api}</span>}</span>;
}
export function SampleBadge() { return <span className="sample-badge"><span/>Demo data</span>; }
export function PanelHeading({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return <div className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{children}</div>;
}
export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('button, input, select, textarea')?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab') {
        const items = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select, textarea, a[href], [tabindex="0"]');
        if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handle);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', handle); previous?.focus(); };
  }, []);
  return <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div ref={ref} className={'modal' + (wide ? ' modal-wide' : '')} role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></div>{children}</div></div>;
}

export function ForecastChart({ offset, expanded, onExpand }: { offset: number; expanded: boolean; onExpand: () => void }) {
  const [selected, setSelected] = useState(3);
  const points = forecast.map((f, i) => ({ ...f, api: Math.max(18, f.api + offset), x: 46 + i * 58, y: 174 - Math.max(18, f.api + offset) * .64 }));
  const path = points.map((p, i) => (i ? 'L' : 'M') + p.x + ',' + p.y).join(' ');
  const active = points[selected];
  return <section className="panel forecast-panel" id="forecast"><PanelHeading title="A clearer picture of your day" subtitle="Air quality forecast · next 9 hours"><button className="chart-select" onClick={onExpand}>{expanded ? 'Less detail' : 'Today'}<ChevronDown size={13}/></button></PanelHeading><div className="forecast-legend"><span><i className="legend-line"/>Predicted API</span><span className="forecast-note">Lower is better <ArrowDownRight size={12}/></span></div><div className="chart-wrap"><svg viewBox="0 0 600 220" role="img" aria-label="Sample forecast: air pollution rises in the afternoon, peaks at 4 PM, and decreases after 7 PM."><defs><linearGradient id="forecast-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dca458" stopOpacity=".21"/><stop offset="100%" stopColor="#e9b060" stopOpacity=".01"/></linearGradient><linearGradient id="forecast-line"><stop offset="0%" stopColor="#d8b450"/><stop offset="30%" stopColor="#d97555"/><stop offset="61%" stopColor="#d97555"/><stop offset="81%" stopColor="#d6b558"/><stop offset="100%" stopColor="#5b926d"/></linearGradient></defs>{[50,100,150,200].map(v => <g key={v}><line x1="35" y1={174-v*.64} x2="580" y2={174-v*.64} stroke="#eceee9" strokeDasharray="3 5"/><text x="23" y={178-v*.64} textAnchor="end" className="chart-label">{v}</text></g>)}<path d={path + ' L568,181 L46,181 Z'} fill="url(#forecast-fill)"/><path d={path} fill="none" stroke="url(#forecast-line)" strokeWidth="3" strokeLinejoin="round"/><line x1={active.x} x2={active.x} y1="28" y2="181" stroke="#b5bcb2" strokeDasharray="3 4"/>{points.map((p, i) => <g key={p.time}><circle cx={p.x} cy={p.y} r={i === selected ? 5 : 3.5} fill={i === selected ? '#fff' : '#b79f6b'} stroke={i === selected ? '#c77952' : '#fff'} strokeWidth="2"/><text x={p.x} y="207" textAnchor="middle" className={'chart-label' + (i === selected ? ' selected' : '')}>{i === 0 ? 'Now' : p.time}</text></g>)}<g transform={'translate(' + Math.min(490, Math.max(45, active.x - 42)) + ',4)'}><rect width="94" height="28" rx="6" fill="#fff" stroke="#e9e8e0"/><text x="47" y="18" textAnchor="middle" className="chart-tooltip">{active.time} · API {active.api}</text></g></svg><div className="chart-hit-targets">{points.map((p, i) => <button key={p.time} onClick={() => setSelected(i)} aria-label={p.time + ', predicted API ' + p.api} aria-pressed={selected === i}/>)}</div></div><div className="forecast-insight"><span className="insight-icon"><Wind size={15}/></span><p>Plan outdoor time <strong>after 7 PM</strong>. Air quality is expected to improve.</p><SampleBadge/></div>{expanded && <div className="forecast-details">{points.map(p => <button key={p.time} className={selected === points.indexOf(p) ? 'selected' : ''} onClick={() => setSelected(points.indexOf(p))}><span>{p.time}</span><strong>{p.api}</strong><span className={'text-' + severity(p.api)}>{severityNames[severity(p.api)]}</span></button>)}</div>}</section>;
}

const mapPaths = [
  'M-20 75 Q130 130 260 80 T630 110', 'M-20 145 Q140 180 310 140 T640 160',
  'M-20 235 Q190 200 330 245 T630 250', 'M-20 315 Q150 280 260 325 T630 300',
  'M80 -20 Q130 130 70 230 T120 440', 'M190 -20 Q160 100 220 250 T180 440',
  'M320 -20 Q280 130 350 235 T330 440', 'M430 -20 Q390 150 470 240 T450 440',
  'M530 -20 Q500 140 550 240 T560 440', 'M-20 410 L610 10', 'M-30 10 L600 380',
];
export function HazeMap({ selected, onSelect, onLocate, located }: { selected: string; onSelect: (city: string) => void; onLocate: () => void; located: boolean }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [details, setDetails] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const active = locations.find(l => l.name === selected) || locations[0];
  const colors: Record<Severity, string> = { safe: '#519b69', mild: '#b8a150', moderate: '#c27d48', severe: '#b45e48', hazardous: '#854741' };
  return <section className="panel map-panel"><PanelHeading title="Around you" subtitle="A local view of the air"><button className="icon-button" onClick={() => setDetails(d => !d)} aria-label="About the map"><Info size={16}/></button></PanelHeading><div className="haze-map" onPointerDown={e => { if ((e.target as HTMLElement).closest('button')) return; drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { if (drag.current) setPan({ x: Math.max(-160, Math.min(160, drag.current.px + e.clientX - drag.current.x)), y: Math.max(-100, Math.min(100, drag.current.py + e.clientY - drag.current.y)) }); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}><div className="map-art" style={{ transform: 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + zoom + ')' }}><svg viewBox="0 0 600 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><pattern id="neighborhood" width="47" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(-15)"><rect width="47" height="34" fill="#eeeee5"/><path d="M0 0H47M0 0V34M23 0V34" stroke="#fff" strokeWidth="3"/><rect x="4" y="5" width="14" height="10" rx="2" fill="#e4e6dc"/><rect x="28" y="20" width="14" height="9" rx="2" fill="#e4e6dc"/></pattern></defs><rect width="600" height="420" fill="url(#neighborhood)"/><path d="M370 0L410 40 430 30 450 80 520 100 560 150 600 135V0Z" fill="#d5dfc9"/><path d="M0 250L50 235 75 275 55 315 100 340 90 420H0Z" fill="#dbe3cf"/><path d="M245 115l35-20 37 15-8 34-43 8-27-17Z M355 235l45-20 40 25-13 34-50 9-24-25Z" fill="#d2dfc4"/>{mapPaths.map((d,i) => <path key={i} d={d} stroke="#fff" strokeWidth={i > 8 ? 9 : 6} fill="none"/>)}<path d="M310 -10Q380 60 330 125T350 230 290 330T300 440" stroke="#b8d7db" strokeWidth="7" fill="none"/><path d="M-20 198Q140 190 260 225T450 180 650 215" stroke="#fff" strokeWidth="12" fill="none"/><path d="M-20 198Q140 190 260 225T450 180 650 215" stroke="#e6d4a1" strokeWidth="3" fill="none"/><path d="M130 -20Q200 110 300 190T480 440" stroke="#fff" strokeWidth="11" fill="none"/><path d="M130 -20Q200 110 300 190T480 440" stroke="#e6d4a1" strokeWidth="3" fill="none"/><text x="475" y="80" className="map-park-label">Klang Gates</text><text x="475" y="94" className="map-park-label">Forest Reserve</text><text x="242" y="136" className="map-park-label">Botanical Gardens</text><text x="408" y="305" className="map-park-label">Taman</text><text x="408" y="318" className="map-park-label">Tasik Permaisuri</text>{locations.map(l => <circle key={l.name} cx={l.x * 6} cy={l.y * 4.2} r={l.name === selected ? 53 : 43} fill={colors[severity(l.api)]} fillOpacity=".16" stroke={colors[severity(l.api)]} strokeOpacity=".23" strokeWidth="1"/>)}</svg>{locations.map(l => <button key={l.name} style={{ left: l.x + '%', top: l.y + '%' }} className={'map-marker ' + severity(l.api) + (l.name === selected ? ' active' : '')} onClick={() => onSelect(l.name)} aria-label={l.name + ', sample API ' + l.api}><span>{l.api}</span><small>{l.name}</small></button>)}<span className="your-location" style={{ left: (active.x + 3) + '%', top: (active.y + 8) + '%' }} title={located ? 'Your approximate GPS area' : 'Demo location'}><i/></span></div><div className="map-top-label"><span className="map-demo-dot"/>Illustrative map · sample readings</div><div className="map-controls"><button aria-label="Zoom in" disabled={zoom >= 1.8} onClick={() => setZoom(z => Math.min(1.8, z + .2))}><Plus size={17}/></button><button aria-label="Zoom out" disabled={zoom <= 1} onClick={() => { setZoom(z => Math.max(1, z - .2)); if (zoom <= 1.2) setPan({ x: 0, y: 0 }); }}><Minus size={17}/></button><button aria-label="Use my location" onClick={onLocate}><LocateFixed size={17}/></button></div><div className="map-compass"><Compass size={19}/></div></div><div className="map-location"><div className="location-icon"><MapPin size={17}/></div><div><strong>{selected}</strong><span>{located ? 'Approximate GPS area' : 'Selected demo location'}</span></div><Badge api={active.api}/></div><div className="map-legend">{(['safe','mild','moderate','severe'] as Severity[]).map(s => <span key={s}><i className={'severity-dot ' + s}/>{severityNames[s]}</span>)}</div>{details && <div className="map-information"><Info size={15}/><p>Drag to pan and select a reading to explore. This is an illustrative Klang Valley map with fixed sample values, not live stations. Blue marks your selected demo area, or approximate GPS area after permission.</p></div>}</section>;
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) { return <div className="empty-state"><span><Check size={24}/></span><h3>{title}</h3><p>{children}</p>{action}</div>; }
export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' | 'success' }) { return <div className={'notice ' + tone}>{tone === 'warning' ? <AlertTriangle size={17}/> : tone === 'success' ? <Check size={17}/> : <Info size={17}/>}<div>{children}</div></div>; }
export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button className="text-link" onClick={onClick}>{children}<ArrowRight size={14}/></button>; }
