import { useState, type ReactNode } from 'react';
import { ArrowUpRight, ChevronRight, Leaf, Wind } from 'lucide-react';
import { forecast, severity, severityNames } from '../ui/model';
export { Modal, HazeMap } from '../ui/components';

export function Brand() {
  return <span className="wordmark"><span className="brand-mark"><Wind size={21} strokeWidth={1.6}/></span>Haze Sentinel</span>;
}
export function ApiBadge({ api, indoor = false }: { api: number; indoor?: boolean }) {
  return <span className={'api-badge ' + severity(api)}><i/>{indoor ? 'Indoor' : severityNames[severity(api)]}{!indoor && <span>{api}</span>}</span>;
}
export function SectionTitle({ children, detail, action }: { children: ReactNode; detail?: string; action?: ReactNode }) {
  return <div className="section-title"><div><h2>{children}</h2>{detail && <p>{detail}</p>}</div>{action}</div>;
}
export function DemoNote({ children = 'Illustrative data · 10 Oct 2026, 12 PM MYT' }: { children?: ReactNode }) {
  return <p className="demo-note"><span/>{children}</p>;
}
export function LinkArrow() { return <ChevronRight size={18} strokeWidth={1.6}/>; }
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="external-link">{children}<ArrowUpRight size={16}/></a>;
}
export function NatureScene({ compact = false, step = 0 }: { compact?: boolean; step?: number }) {
  return <svg className={'nature-scene' + (compact ? ' compact' : '')} viewBox="0 0 400 380" role="img" aria-label="A peaceful Malaysian park with a sun, flowing air, and botanical shapes">
    <defs><clipPath id={'scene-clip-' + step}><rect width="400" height="380" rx="36"/></clipPath></defs>
    <g clipPath={'url(#scene-clip-' + step + ')'}>
      <rect width="400" height="380" fill="#EFE8D9"/>
      <circle cx="285" cy="99" r="48" fill="#C5825D"/>
      <circle cx="285" cy="99" r="61" fill="none" stroke="#C5825D" strokeOpacity=".25"/>
      <path d="M-30 240Q60 124 176 228T440 170V410H-30Z" fill="#BBC5A8"/>
      <path d="M-20 295Q99 187 205 286T430 234V410H-20Z" fill="#89966F"/>
      <path d="M-20 355Q140 240 310 336T430 298V410H-20Z" fill="#566847"/>
      <path d="M196 380Q275 331 229 308T247 268" stroke="#F2E9D6" strokeWidth="12" fill="none"/>
      <g fill="none" stroke="#7D8B69" strokeWidth="2" strokeLinecap="round"><path d="M28 89h103q23 0 23-16t-24-14"/><path d="M53 109h115q27 0 27-19"/><path d="M24 129h78"/></g>
      <g fill="#E5DFC9"><rect x="168" y="188" width="8" height="54" rx="2"/><rect x="183" y="188" width="8" height="54" rx="2"/><path d="M171 183l1-15 1-9 2 24ZM186 183l1-15 1-9 2 24Z"/><rect x="174" y="203" width="12" height="4"/><rect x="204" y="200" width="13" height="43" rx="2"/><path d="M210 196v-19m-5 14h10" stroke="#E5DFC9" strokeWidth="2"/></g>
      <g stroke="#334A35" strokeWidth="3" fill="none" strokeLinecap="round"><path d="M51 372q7-61 36-110M69 332q-29-29-31-52M76 302q25-9 37-33"/><path d="M356 384q-16-60-1-120M353 336q-32-12-41-43"/></g>
      <g fill="#D5D9BC"><ellipse cx="44" cy="288" rx="10" ry="23" transform="rotate(-36 44 288)"/><ellipse cx="96" cy="282" rx="10" ry="24" transform="rotate(39 96 282)"/><ellipse cx="81" cy="268" rx="9" ry="20" transform="rotate(24 81 268)"/><ellipse cx="355" cy="276" rx="11" ry="25" transform="rotate(10 355 276)"/><ellipse cx="321" cy="302" rx="10" ry="22" transform="rotate(-40 321 302)"/></g>
      {step === 1 && <g transform="translate(138 92)"><rect width="110" height="93" rx="15" fill="#FFFDF8" stroke="#D9D1C2"/><path d="M0 27h110" stroke="#D9D1C2"/><path d="M26-5v17m58-17v17" stroke="#526344" strokeWidth="5" strokeLinecap="round"/><path d="m30 57 15 15 33-32" stroke="#526344" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></g>}
      {step === 2 && <g transform="translate(135 98)"><rect width="132" height="82" rx="22" fill="#FFFDF8"/><path d="m20 73-4 26 30-18" fill="#FFFDF8"/><path d="M27 29h80M27 45h60M27 61h42" stroke="#7D8B69" strokeWidth="4" strokeLinecap="round"/></g>}
    </g>
  </svg>;
}
export function Forecast({ offset }: { offset: number }) {
  const [selected, setSelected] = useState(0);
  const values = forecast.map(f => ({ ...f, api: Math.max(18, f.api + offset) }));
  const active = values[selected];
  const max = Math.max(220, ...values.map(f => f.api));
  const y = (api: number) => 113 - api / max * 83;
  const points = values.map((f, i) => `${i ? 'L' : 'M'}${12 + i * 34},${y(f.api)}`).join(' ');
  return <section className="forecast-section"><SectionTitle detail="Sample hourly API · lower is better" action={<span className="small-muted">MYT</span>}>The hours ahead</SectionTitle>
    <div className="forecast-active"><span>{selected === 0 ? 'Now' : active.time}</span><strong>{active.api}</strong><ApiBadge api={active.api}/></div>
    <svg viewBox="0 0 330 140" className="forecast-svg" role="img" aria-label="Illustrative hourly air pollution index trend">
      {[50, 100, 200].map(n => <g key={n}><line x1="12" x2="318" y1={y(n)} y2={y(n)} stroke="#DED8CB" strokeDasharray="3 4"/><text x="318" y={y(n)-5} textAnchor="end" fill="#827A6B" fontSize="9">{n}</text></g>)}
      <path d={points + 'L318,123L12,123Z'} fill="#E6D6BE" opacity=".65"/><path d={points} fill="none" stroke="#A75237" strokeWidth="2.5" strokeLinejoin="round"/>
      <circle cx={12 + selected * 34} cy={y(active.api)} r="5" fill="#FFFDF8" stroke="#A75237" strokeWidth="2"/>
    </svg>
    <div className="forecast-hours" aria-label="Select forecast hour">{values.map((f, i) => <button key={f.hour} className={selected === i ? 'selected' : ''} aria-pressed={selected === i} onClick={() => setSelected(i)}><span>{i === 0 ? 'Now' : f.time}</span><Wind size={16}/><strong>{f.api}</strong></button>)}</div>
  </section>;
}
export function BotanicalNote({ children }: { children: ReactNode }) { return <div className="botanical-note"><Leaf size={18} strokeWidth={1.4}/><span>{children}</span></div>; }
