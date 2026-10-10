import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, Bike, CalendarClock, ChevronRight, Footprints, Leaf, Plus, Wind } from 'lucide-react';
import { timeLabel, TODAY, type Plan, type Proposal } from '../ui/model';
import { ApiBadge } from './Kit';

export type Message = { id: string; role: 'user' | 'assistant'; text: string; proposals?: Proposal[] };
const prompts = [
  { icon: Footprints, label: 'Go jogging', text: 'May I go jogging now?' },
  { icon: Bike, label: 'Go cycling', text: 'When is a better time to go cycling?' },
  { icon: CalendarClock, label: 'Replan my day', text: 'Reschedule my outdoor plans, keeping classes fixed.' },
  { icon: Wind, label: 'Understand haze', text: 'What does today’s haze outlook mean?' },
];
export function Assistant({ messages, busy, plans, onSend, onClear, onReview, embedded = false }: { messages: Message[]; busy: boolean; plans: Plan[]; onSend: (text: string) => void; onClear: () => void; onReview: (proposals: Proposal[]) => void; embedded?: boolean }) {
  const [text, setText] = useState('');
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => { if (messages.length) scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: 'smooth' }); }, [messages.length, busy]);
  const send = (e: FormEvent) => { e.preventDefault(); if (!busy && text.trim()) { onSend(text.trim()); setText(''); } };
  return <section className={'assistant-page' + (embedded ? ' embedded' : '')} aria-label="Haze assistant">
    {!embedded && <header className="assistant-heading"><div><span className="small-muted">A little guidance</span><h1>Your haze companion.</h1></div><button className="icon-button bordered" onClick={onClear} aria-label="New conversation"><Plus size={20}/></button></header>}
    <div className="prompt-strip" aria-label="Quick activity questions">{prompts.map(({ icon: Icon, label, text: question }) => <button key={label} onClick={() => onSend(question)} disabled={busy}><span><Icon size={25} strokeWidth={1.4}/></span><strong>{label}</strong></button>)}</div>
    <div className="conversation" ref={scroll} role="log" aria-live="polite" aria-label="Conversation">
      {!messages.length ? <div className="assistant-empty"><Leaf size={26} strokeWidth={1.1}/><h2>What’s on your<br/>mind today?</h2><p>Ask about the air, your outdoor plans,<br/>or a little room to reschedule.</p><span>Uses demo readings and planning rules.</span></div> : messages.map(m => <div key={m.id} className={'message ' + m.role}>{m.role === 'assistant' && <span className="message-label"><Wind size={15}/>Haze Sentinel</span>}<p>{m.text}</p>{m.proposals?.length ? <div className="proposal-preview"><div className="proposal-preview-heading"><CalendarClock size={18}/><strong>A little change of plan</strong></div>{m.proposals.map(p => { const original = plans.find(a => a.id === p.id); return <div key={p.id} className="proposal-preview-row"><span>{original?.title || 'Activity'}</span><strong>{p.date === TODAY ? 'Today' : 'Tomorrow'}, {timeLabel(p.time)}</strong><ApiBadge api={p.api} indoor={!p.outdoor}/></div>; })}<button className="button primary full" onClick={() => onReview(m.proposals!)}>Review {m.proposals.length} {m.proposals.length === 1 ? 'change' : 'changes'}<ChevronRight size={17}/></button><small>Fixed commitments stay in place.</small></div> : null}</div>)}
      {busy && <div className="thinking"><span/><span/><span/><small>Looking at your plans…</small></div>}
    </div>
    <form className="composer" onSubmit={send}><label className="sr-only" htmlFor={embedded ? 'sheet-message' : 'assistant-message'}>Ask Haze Sentinel</label><textarea id={embedded ? 'sheet-message' : 'assistant-message'} rows={1} value={text} onChange={e => setText(e.target.value)} maxLength={1500} placeholder="Ask about your day…" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (text.trim() && !busy) { onSend(text.trim()); setText(''); } } }}/><button type="submit" disabled={!text.trim() || busy} aria-label="Send message"><ArrowUp size={21}/></button></form>
    <p className="chat-caption">Demo assistant · verify current conditions before heading out.</p>
  </section>;
}
