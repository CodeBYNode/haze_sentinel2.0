import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Bell, CalendarDays, Check, ChevronRight, Footprints, House, LocateFixed, LockKeyhole, MapPin, MessageCircle, Search, UserRound, Wind, X } from 'lucide-react';
import { applyProposals, affectedPlans, defaultProfile, initialPlans, locations, proposeChanges, timeLabel, TODAY, type Page, type Plan, type Proposal, type UserProfile } from '../ui/model';
import { Auth, Onboarding, Profile } from './Account';
import { Assistant, type Message } from './Assistant';
import { ApiBadge, Brand, Modal } from './Kit';
import { replyTo } from './planning';
import { Schedule } from './Schedule';
import { Today } from './Today';

const PLANS_KEY = 'haze-sentinel-mobile-plans-v1';
const INTRO_KEY = 'haze-sentinel-introduction';
function readPlans(): Plan[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PLANS_KEY) || 'null');
    if (Array.isArray(raw) && raw.every(p => p && typeof p.id === 'string' && typeof p.title === 'string' && typeof p.location === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(p.time) && Number.isFinite(p.api) && [30, 60, 90, 120].includes(p.duration) && typeof p.outdoor === 'boolean' && typeof p.fixed === 'boolean' && ['run', 'class', 'coffee', 'cycle', 'other'].includes(p.kind))) return raw;
  } catch { /* Recover from unavailable storage or invalid data. */ }
  return initialPlans.map(p => ({ ...p }));
}
function initialPage(): Page { const route = window.location.hash.slice(1); return ['schedule', 'assistant', 'profile', 'login', 'signup'].includes(route) ? route as Page : 'home'; }
function needsIntro() { try { return !localStorage.getItem(INTRO_KEY) && !window.location.hash; } catch { return !window.location.hash; } }

export default function App() {
  const [page, setPage] = useState<Page>(initialPage);
  const [onboarding, setOnboarding] = useState(needsIntro);
  const [plans, setPlans] = useState<Plan[]>(readPlans);
  const [profile, setProfile] = useState<UserProfile>({ ...defaultProfile, name: 'Guest', email: '', conditions: [] });
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [affectedOpen, setAffectedOpen] = useState(false);
  const [scheduleChat, setScheduleChat] = useState(false);
  const [scope, setScope] = useState<string | undefined>();
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const available = import.meta.env.VITE_AIR_QUALITY_DEMO !== 'false';
  const notify = (message: string) => setToast(message);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4200); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => () => clearTimeout(pending.current), []);
  useEffect(() => {
    const resize = () => { const height = window.visualViewport?.height || window.innerHeight; document.documentElement.style.setProperty('--app-height', height + 'px'); setKeyboard(height < window.innerHeight * .78); };
    resize(); window.visualViewport?.addEventListener('resize', resize); window.addEventListener('resize', resize);
    return () => { window.visualViewport?.removeEventListener('resize', resize); window.removeEventListener('resize', resize); };
  }, []);
  const navigate = (next: Page) => { setPage(next); setScheduleChat(false); setScope(undefined); window.history.replaceState(null, '', '#' + (next === 'home' ? 'today' : next)); window.scrollTo({ top: 0 }); };
  const finishIntro = (next: Page = 'home') => { try { localStorage.setItem(INTRO_KEY, 'done'); } catch { /* Introduction can still be dismissed for this session. */ } setOnboarding(false); navigate(next); };
  const changePlans = (next: Plan[]) => { setPlans(next); try { localStorage.setItem(PLANS_KEY, JSON.stringify(next)); } catch { notify('Changes are held for this session. Browser storage is unavailable.'); } };
  const send = (text: string) => {
    if (busy || !text.trim()) return;
    setMessages(m => [...m, { id: crypto.randomUUID(), role: 'user', text: text.trim() }]); setBusy(true);
    pending.current = setTimeout(() => { const result = replyTo(text, plans, profile.location, scope); setMessages(m => [...m, { id: crypto.randomUUID(), role: 'assistant', ...result }]); setBusy(false); }, 350);
  };
  const clearChat = () => { clearTimeout(pending.current); setBusy(false); setMessages([]); };
  const openChat = (plan?: Plan) => { clearChat(); setScope(plan?.id); setScheduleChat(true); };
  const review = (next: Proposal[]) => {
    const refreshed = proposeChanges(plans, next.every(p => !p.outdoor), next.map(p => p.id));
    if (!refreshed.length) { notify('Your plans have changed. Ask for a fresh suggestion.'); return; }
    setScheduleChat(false); setProposals(refreshed);
  };
  const chooseLocation = (city: string) => { setProfile(p => ({ ...p, location: city })); setLocationOpen(false); setLocationSearch(''); };
  const locate = () => {
    if (!navigator.geolocation) { notify('Device location is unavailable. Choose an area below.'); setLocationOpen(true); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      const coords: [string, number, number][] = [['Kuala Lumpur',3.139,101.687],['Petaling Jaya',3.108,101.606],['Shah Alam',3.073,101.519],['Batu Caves',3.237,101.684],['Ampang',3.15,101.76],['Subang Jaya',3.05,101.58]];
      const closest = coords.map(([city, lat, lon]) => ({ city, distance: Math.hypot((lat-pos.coords.latitude)*111,(lon-pos.coords.longitude)*111*Math.cos(lat*Math.PI/180)) })).sort((a,b) => a.distance-b.distance)[0];
      if (closest.distance > 45) { notify('Your area is outside the demo map. Choose a demo location.'); setLocationOpen(true); return; }
      chooseLocation(closest.city); notify('Nearest demo area selected. Readings are still illustrative.');
    }, () => { notify('Location wasn’t available. Choose an area manually.'); setLocationOpen(true); }, { timeout: 8000, maximumAge: 600000 });
  };
  const affected = affectedPlans(plans);
  if (onboarding) return <Onboarding onDone={() => finishIntro()} onLogin={() => finishIntro('login')}/>;
  if (page === 'login' || page === 'signup') return <Auth key={page} mode={page} onNavigate={navigate}/>;
  return <div className={'app-shell' + (keyboard ? ' keyboard-open' : '')}>
    <header className="app-topbar"><button className="brand-button" onClick={() => navigate('home')} aria-label="Haze Sentinel today"><Brand/></button><div className="topbar-actions"><button className="icon-button notification-button" aria-label="View affected plans" onClick={() => setAffectedOpen(true)}><Bell size={20} strokeWidth={1.5}/>{affected.length > 0 && <i/>}</button><button className="top-avatar" onClick={() => navigate('profile')} aria-label="Open profile">{profile.name === 'Guest' ? <UserRound size={16}/> : profile.name.slice(0, 1)}</button></div></header>
    <div className="demo-banner"><span/>{available ? 'Demo experience' : 'Live data unavailable'}<span className="demo-banner-detail">{available ? 'A preview of clearer days' : 'No provider connected'}</span></div>
    <main className={'page-content ' + page}>
      {page === 'home' && <Today key={profile.location} location={profile.location} plans={plans} onLocation={() => setLocationOpen(true)} onAffected={() => setAffectedOpen(true)} onLocate={locate} available={available}/>}
      {page === 'schedule' && <Schedule plans={plans} location={profile.location} onChange={changePlans} onChat={openChat} notify={notify}/>}
      {page === 'assistant' && <Assistant plans={plans} messages={messages} busy={busy} onSend={send} onClear={clearChat} onReview={review}/>}
      {page === 'profile' && <Profile profile={profile} onSave={setProfile} onNavigate={navigate} notify={notify} onReplay={() => setOnboarding(true)}/>}
    </main>
    <nav className="bottom-nav" aria-label="Main navigation">{[{ page: 'home' as const, title: 'Today', icon: House }, { page: 'schedule' as const, title: 'Schedule', icon: CalendarDays }, { page: 'assistant' as const, title: 'Assistant', icon: MessageCircle }, { page: 'profile' as const, title: 'Profile', icon: UserRound }].map(({ page: target, title, icon: Icon }) => <button key={target} className={page === target ? 'active' : ''} aria-current={page === target ? 'page' : undefined} onClick={() => navigate(target)}><span><Icon size={21} strokeWidth={1.6}/></span>{title}</button>)}</nav>
    {toast && <div className="toast" role="status"><Check size={17}/><span>{toast}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={17}/></button></div>}
    {locationOpen && <Modal title="Find your little corner" onClose={() => setLocationOpen(false)}><p className="body-copy">Choose a location in the Klang Valley demo.</p><label className="location-search"><Search size={18}/><input aria-label="Search locations" value={locationSearch} onChange={e => setLocationSearch(e.target.value)} placeholder="Search for an area…"/></label><button className="locate-button" onClick={locate}><LocateFixed size={18}/>Use device location<ArrowRight size={17}/></button><div className="city-options">{locations.filter(l => l.name.toLowerCase().includes(locationSearch.toLowerCase())).map(l => <button key={l.name} onClick={() => chooseLocation(l.name)}><MapPin size={18}/><span><strong>{l.name}</strong><small>{l.district}</small></span>{profile.location === l.name ? <Check size={18}/> : <ChevronRight size={17}/>}</button>)}{!locations.some(l => l.name.toLowerCase().includes(locationSearch.toLowerCase())) && <p className="body-copy">No matching demo area. Try Kuala Lumpur or Petaling Jaya.</p>}</div></Modal>}
    {affectedOpen && <Modal title={affected.length ? 'Plans worth a second look' : 'A little breathing room'} onClose={() => setAffectedOpen(false)}><p className="body-copy">{affected.length ? 'These upcoming outdoor plans overlap with higher API values in the demo outlook.' : 'No movable outdoor plans overlap with higher demo readings right now.'}</p>{affected.map(p => <div className="affected-plan" key={p.id}><span className="activity-icon run"><Footprints size={20}/></span><div><strong>{p.title}</strong><small>{p.date === TODAY ? 'Today' : p.date}, {timeLabel(p.time)}</small></div><ApiBadge api={p.api}/></div>)}<button className="button primary full" onClick={() => { setAffectedOpen(false); navigate('schedule'); }}>Review my schedule<ArrowRight size={17}/></button></Modal>}
    {scheduleChat && <Modal title={scope ? 'A better time for your plan' : 'A little help replanning'} onClose={() => { setScheduleChat(false); setScope(undefined); }}><Assistant embedded messages={messages} plans={plans} busy={busy} onSend={send} onClear={clearChat} onReview={review}/></Modal>}
    {proposals && <Modal title="A little change of plan" onClose={() => setProposals(null)}><p className="body-copy">Review each suggested change before saving. These times use the sample outlook.</p>{proposals.map(p => { const old = plans.find(a => a.id === p.id); return <div className="review-change" key={p.id}><h3>{old?.title || 'Activity'}</h3><div className="before-after"><div><span>Original</span><strong>{old?.date === TODAY ? 'Today' : old?.date}, {old ? timeLabel(old.time) : '—'}</strong>{old && <ApiBadge api={old.api} indoor={!old.outdoor}/>}</div><ArrowRight size={17}/><div><span>Suggested</span><strong>{p.date === TODAY ? 'Today' : p.date}, {timeLabel(p.time)}</strong><ApiBadge api={p.api} indoor={!p.outdoor}/></div></div><p><MapPin size={13}/>{p.location}</p><small>{p.reason}</small></div>; })}<div className="fixed-note"><LockKeyhole size={15}/>Fixed commitments stay unchanged.</div><div className="sheet-actions"><button className="button secondary" onClick={() => setProposals(null)}>Keep my plan</button><button className="button primary" onClick={() => { changePlans(applyProposals(plans, proposals)); setProposals(null); notify('Your schedule has been updated.'); navigate('schedule'); }}>Confirm {proposals.length} {proposals.length === 1 ? 'change' : 'changes'}</button></div></Modal>}
    <span className="sr-only"><Wind/>Haze Sentinel mobile preview</span>
  </div>;
}
