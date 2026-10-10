import { useEffect, useRef, useState, type FormEvent } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowUp, Bike, CalendarClock, ChevronRight, Footprints, Leaf, Plus, Wind } from 'lucide-react';
import { timeLabel, TODAY, type Plan, type Proposal } from '../ui/model';
import { ApiBadge } from './Kit';
import type { AQReading, Profile } from '../core/types';
import type { TomorrowAssessment } from '../services/hazeai';
import { timestamp } from './backend';
import { LiveReadingBadge } from './Today';

export type Message = { id: string; role: 'user' | 'assistant'; text: string; proposals?: Proposal[]; mode?: 'live' | 'demo'; location?: string; reading?: AQReading; assessment?: TomorrowAssessment; dataError?: string; error?: boolean; retryText?: string; requestProfile?: Profile };
const prompts = [
  { icon: Footprints, label: 'Go jogging', text: 'May I go jogging now?' },
  { icon: Bike, label: 'Go cycling', text: 'When is a better time to go cycling?' },
  { icon: CalendarClock, label: 'Replan my day', text: 'Reschedule my outdoor plans, keeping classes fixed.' },
  { icon: Wind, label: 'Understand haze', text: 'What does today’s haze outlook mean?' },
];
export function Assistant({ messages, busy, plans, onSend, onClear, onReview, onRetry, embedded = false }: { messages: Message[]; busy: boolean; plans: Plan[]; onSend: (text: string) => void; onClear: () => void; onReview: (proposals: Proposal[]) => void; onRetry?: (message: Message) => void; embedded?: boolean }) {
  const [text, setText] = useState('');
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => { if (messages.length) scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: 'smooth' }); }, [messages.length, busy]);
  const send = (e: FormEvent) => { e.preventDefault(); if (!busy && text.trim()) { onSend(text.trim()); setText(''); } };
  return <section className={'assistant-page' + (embedded ? ' embedded' : '')} aria-label="Haze assistant">
    {!embedded && <header className="assistant-heading"><div><span className="small-muted">A little guidance</span><h1>Your haze companion.</h1></div><button className="icon-button bordered" onClick={onClear} aria-label="New conversation"><Plus size={20}/></button></header>}
    <div className="prompt-strip" aria-label="Quick activity questions">{prompts.map(({ icon: Icon, label, text: question }) => <button key={label} onClick={() => onSend(question)} disabled={busy}><span><Icon size={25} strokeWidth={1.4}/></span><strong>{label}</strong></button>)}</div>
    <div className="conversation" ref={scroll} role="log" aria-live="polite" aria-label="Conversation">
      {!messages.length ? <div className="assistant-empty"><Leaf size={26} strokeWidth={1.1}/><h2>What’s on your<br/>mind today?</h2><p>Ask about the air, your outdoor plans,<br/>or a little room to reschedule.</p><span>{embedded ? 'Demo schedule and sample planning rules.' : 'Air-quality answers come from the backend. Schedule changes use demo rules.'}</span></div> : messages.map(m => <div key={m.id} className={'message ' + m.role + (m.error ? ' message-error' : '')}>{m.role === 'assistant' && <span className="message-label"><Wind size={15}/>{m.mode === 'demo' ? 'Demo planning assistant' : 'Haze Sentinel'}{m.location && <small> · {m.location}</small>}</span>}<div className="assistant-markdown"><Markdown remarkPlugins={[remarkGfm]} components={{ a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer">{children}</a> }}>{m.text}</Markdown></div>{m.error && onRetry && m.id === messages.at(-1)?.id && <button className="text-button" disabled={busy} onClick={() => onRetry(m)}>Try again</button>}{m.dataError && <p className="live-notice">{m.dataError}</p>}{m.reading && <div className="chat-reading"><LiveReadingBadge reading={m.reading}/><p>WAQI AQI · {m.reading.station || m.location}<br/>Observed {timestamp(m.reading.observedAt)}</p></div>}{m.assessment && <TomorrowCard assessment={m.assessment}/ >}{m.proposals?.length ? <div className="proposal-preview"><div className="proposal-preview-heading"><CalendarClock size={18}/><strong>A little change of plan</strong></div>{m.proposals.map(p => { const original = plans.find(a => a.id === p.id); return <div key={p.id} className="proposal-preview-row"><span>{original?.title || 'Activity'}</span><strong>{p.date === TODAY ? 'Today' : 'Tomorrow'}, {timeLabel(p.time)}</strong><ApiBadge api={p.api} indoor={!p.outdoor}/></div>; })}<button className="button primary full" onClick={() => onReview(m.proposals!)}>Review {m.proposals.length} {m.proposals.length === 1 ? 'change' : 'changes'}<ChevronRight size={17}/></button><small>Demo proposal · sample readings. Review before saving.</small></div> : null}</div>)}
      {busy && <div className="thinking" role="status"><span/><span/><span/><small>{embedded ? 'Looking at your demo plans…' : 'Asking Haze Sentinel…'}</small></div>}
    </div>
    <form className="composer" onSubmit={send}><label className="sr-only" htmlFor={embedded ? 'sheet-message' : 'assistant-message'}>Ask Haze Sentinel</label><textarea id={embedded ? 'sheet-message' : 'assistant-message'} rows={1} value={text} onChange={e => setText(e.target.value)} maxLength={1500} placeholder="Ask about your day…" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (text.trim() && !busy) { onSend(text.trim()); setText(''); } } }}/><button type="submit" disabled={!text.trim() || busy} aria-label="Send message"><ArrowUp size={21}/></button></form>
    <p className="chat-caption">{embedded ? 'Demo replanning · sample schedule and hourly values.' : 'Backend air-quality assistant · schedule proposals use demo data.'}</p>
  </section>;
}

function TomorrowCard({ assessment: a }: { assessment: TomorrowAssessment }) {
  return <details className="tomorrow-card"><summary>Tomorrow’s outlook · {a.assessment_date}</summary><div><strong>{a.risk_level === 'unknown' ? 'Unable to assess' : a.risk_level.replaceAll('_', ' ')}</strong><p>{a.outdoor_guidance.replaceAll('_', ' ')}</p><p>{a.index_name} · daily forecast maximum: {a.forecast_index ?? 'unavailable'}<br/>Confidence: {a.confidence} · forecast issue time: {timestamp(a.forecast_timestamp)}</p>{a.reasoning_factors?.length > 0 && <ul>{a.reasoning_factors.map(reason => <li key={reason}>{reason}</li>)}</ul>}{a.personalised_considerations?.length > 0 && <ul>{a.personalised_considerations.map(reason => <li key={reason}>{reason}</li>)}</ul>}{a.recommended_precautions?.length > 0 && <ul>{a.recommended_precautions.map(reason => <li key={reason}>{reason}</li>)}</ul>}{a.limitations?.length > 0 && <p className="fine-print">{a.limitations.join(' ')}</p>}<p className="fine-print">{a.data_source} · generated {timestamp(a.generated_at)}. This is a daily outlook, separate from conditions now.</p></div></details>;
}
