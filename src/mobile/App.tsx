import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Bell, CalendarDays, Check, Footprints, House, LockKeyhole, MapPin, MessageCircle, UserRound, Wind, X } from 'lucide-react';
import { applyProposals, affectedPlans, defaultProfile, initialPlans, proposeChanges, timeLabel, TODAY, type Page, type Plan, type Proposal, type UserProfile } from '../ui/model';
import { getCurrentAir, normalizeReading, type StationOption } from '../services/airQuality';
import { askHazeAI } from '../services/hazeai';
import { Auth, Onboarding, Profile } from './Account';
import { Assistant, type Message } from './Assistant';
import { ApiBadge, Brand, Modal } from './Kit';
import { replyTo } from './planning';
import { Schedule } from './Schedule';
import { Today } from './Today';
import { LocationSearch } from './LocationSearch';
import { backendHistory, backendProfile, isPlanningRequest } from './backend';
import { useLiveData } from './useLiveData';
import { SpendingsModal } from './Spendings';
import { restoredBooking } from './spendingTypes';
import { useSpendings } from './useSpendings';

const PLANS_KEY = 'haze-sentinel-mobile-plans-v1';
const INTRO_KEY = 'haze-sentinel-introduction';
function readPlans(): Plan[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PLANS_KEY) || 'null');
    if (Array.isArray(raw) && raw.every(p => p && typeof p.id === 'string' && typeof p.title === 'string' && typeof p.location === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(p.time) && Number.isFinite(p.api) && [30, 60, 90, 120].includes(p.duration) && typeof p.outdoor === 'boolean' && typeof p.fixed === 'boolean' && ['run', 'class', 'coffee', 'cycle', 'other'].includes(p.kind))) return raw.map(p => ({ ...p, booking: restoredBooking(p.booking) }));
  } catch { /* Recover from unavailable storage or invalid data. */ }
  return initialPlans.map(p => ({ ...p }));
}
function initialPage(): Page { const route = window.location.hash.slice(1); return ['schedule', 'assistant', 'profile', 'login', 'signup'].includes(route) ? route as Page : 'home'; }
function needsIntro() { try { return !localStorage.getItem(INTRO_KEY) && !window.location.hash; } catch { return !window.location.hash; } }

export default function App() {
  const [spendingsOpen, setSpendingsOpen] = useState(false);
  const [spendingId, setSpendingId] = useState<string | undefined>();
  const [bookingEditor, setBookingEditor] = useState<string | undefined>();
  const [page, setPage] = useState<Page>(initialPage);
  const [onboarding, setOnboarding] = useState(needsIntro);
  const [plans, setPlans] = useState<Plan[]>(readPlans);
  const [profile, setProfile] = useState<UserProfile>({ ...defaultProfile, name: 'Guest', email: '', conditions: [] });
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [locationOpen, setLocationOpen] = useState(false);
  const [station, setStation] = useState<StationOption | null>(null);
  const [locating, setLocating] = useState(false);
  const [affectedOpen, setAffectedOpen] = useState(false);
  const [scheduleChat, setScheduleChat] = useState(false);
  const [scope, setScope] = useState<string | undefined>();
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const pending = useRef(false);
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const locateRequest = useRef<AbortController | null>(null);
  const apiProfile = backendProfile(profile, station);
  const live = useLiveData(apiProfile, !onboarding && page !== 'login' && page !== 'signup');
  const spendings = useSpendings(plans, !onboarding && page !== 'login' && page !== 'signup');
  const openSpendings = (id?: string) => { setSpendingId(id); setSpendingsOpen(true); };
  const notify = (message: string) => setToast(message);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4200); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => () => { request.current?.abort(); locateRequest.current?.abort(); }, []);
  useEffect(() => {
    const resize = () => { const height = window.visualViewport?.height || window.innerHeight; document.documentElement.style.setProperty('--app-height', height + 'px'); setKeyboard(height < window.innerHeight * .78); };
    resize(); window.visualViewport?.addEventListener('resize', resize); window.addEventListener('resize', resize);
    return () => { window.visualViewport?.removeEventListener('resize', resize); window.removeEventListener('resize', resize); };
  }, []);
  const navigate = (next: Page) => { setPage(next); setScheduleChat(false); setScope(undefined); window.history.replaceState(null, '', '#' + (next === 'home' ? 'today' : next)); window.scrollTo({ top: 0 }); };
  const finishIntro = (next: Page = 'home') => { try { localStorage.setItem(INTRO_KEY, 'done'); } catch { /* Introduction can still be dismissed for this session. */ } setOnboarding(false); navigate(next); };
  const changePlans = (next: Plan[]) => { setPlans(next); try { localStorage.setItem(PLANS_KEY, JSON.stringify(next)); } catch { notify('Changes are held for this session. Browser storage is unavailable.'); } };
  const send = async (raw: string, retry?: Message) => {
    const text = raw.trim();
    if (pending.current || !text) return;
    pending.current = true; setBusy(true);
    const seq = ++sequence.current;
    const controller = new AbortController(); request.current = controller;
    const demo = retry ? retry.mode === 'demo' : scheduleChat || isPlanningRequest(text);
    const contextProfile = retry?.requestProfile || apiProfile;
    const historyMessages = retry ? messages.slice(0, messages.findIndex(m => m.id === retry.id)) : [...messages, { id: crypto.randomUUID(), role: 'user' as const, mode: demo ? 'demo' as const : 'live' as const, location: contextProfile.location, text }];
    setMessages(historyMessages);
    try {
      if (demo) {
        const result = replyTo(text, plans, profile.location, scope);
        if (seq === sequence.current) setMessages(m => [...m, { id: crypto.randomUUID(), role: 'assistant', mode: 'demo', location: profile.location, ...result }]);
      } else {
        const history = backendHistory(historyMessages, contextProfile.location);
        const result = await askHazeAI(history, contextProfile, controller.signal);
        if (seq === sequence.current) setMessages(m => [...m, { id: crypto.randomUUID(), role: 'assistant', mode: 'live', text: result.reply, location: contextProfile.location, assessment: result.assessment, reading: result.reading ? normalizeReading(result.reading) : undefined, dataError: result.dataError || undefined }]);
      }
    } catch (error) {
      if (seq === sequence.current && !controller.signal.aborted) setMessages(m => [...m, { id: crypto.randomUUID(), role: 'assistant', mode: 'live', text: error instanceof Error ? error.message : 'The assistant is unavailable. Please retry.', error: true, retryText: text, requestProfile: contextProfile, location: contextProfile.location }]);
    } finally { if (seq === sequence.current) { pending.current = false; setBusy(false); } }
  };
  const clearChat = () => { sequence.current++; request.current?.abort(); pending.current = false; setBusy(false); setMessages([]); };
  const openChat = (plan?: Plan) => { clearChat(); setScope(plan?.id); setScheduleChat(true); };
  const review = (next: Proposal[]) => {
    const refreshed = proposeChanges(plans, next.every(p => !p.outdoor), next.map(p => p.id));
    if (!refreshed.length) { notify('Your plans have changed. Ask for a fresh suggestion.'); return; }
    setScheduleChat(false); setProposals(refreshed);
  };
  const chooseLocation = (next: StationOption) => { locateRequest.current?.abort(); setLocating(false); setStation(next); setProfile(p => ({ ...p, location: next.name })); setLocationOpen(false); };
  const locate = () => {
    if (!navigator.geolocation) { notify('Device location is unavailable. Choose an area below.'); setLocationOpen(true); return; }
    if (locating) return;
    setLocating(true);
    const controller = new AbortController(); locateRequest.current = controller;
    navigator.geolocation.getCurrentPosition(async pos => {
      if (controller.signal.aborted) return;
      try {
        const reading = await getCurrentAir({ ...apiProfile, stationId: undefined, locationCoords: { lat: pos.coords.latitude, lon: pos.coords.longitude } }, controller.signal);
        if (!controller.signal.aborted) {
          const coordinates = reading.coordinates?.lat != null && reading.coordinates?.lon != null ? { lat: reading.coordinates.lat, lon: reading.coordinates.lon } : null;
          if (!reading.station || !coordinates) throw new Error('The provider returned no station coordinates. Choose a station manually.');
          chooseLocation({ name: reading.station, stationId: reading.stationId || '', coordinates, aqi: reading.aqi ?? null });
          notify('Provider monitoring station selected.');
        }
      } catch (error) { if (!controller.signal.aborted) { notify(error instanceof Error ? error.message : 'Station lookup failed.'); setLocationOpen(true); } }
      finally { if (!controller.signal.aborted) setLocating(false); }
    }, () => { if (!controller.signal.aborted) { notify('Location wasn’t available. Choose a station manually.'); setLocationOpen(true); setLocating(false); } }, { timeout: 8000, maximumAge: 600000 });
  };
  const affected = affectedPlans(plans);
  if (onboarding) return <Onboarding onDone={() => finishIntro()} onLogin={() => finishIntro('login')}/>;
  if (page === 'login' || page === 'signup') return <Auth key={page} mode={page} onNavigate={navigate}/>;
  return <div className={'app-shell' + (keyboard ? ' keyboard-open' : '')}>
    <header className="app-topbar"><button className="brand-button" onClick={() => navigate('home')} aria-label="Haze Sentinel today"><Brand/></button><div className="topbar-actions"><button className="icon-button notification-button" aria-label="View affected plans" onClick={() => setAffectedOpen(true)}><Bell size={20} strokeWidth={1.5}/>{affected.length > 0 && <i/>}</button><button className="top-avatar" onClick={() => navigate('profile')} aria-label="Open profile">{profile.name === 'Guest' ? <UserRound size={16}/> : profile.name.slice(0, 1)}</button></div></header>
    <div className="demo-banner"><span/>{page === 'schedule' ? 'Demo schedule' : live.airLoading ? 'Loading air quality' : live.reading ? 'WAQI provider data' : 'Air quality unavailable'}<span className="demo-banner-detail">Schedule &amp; replanning use demo data</span></div>
    <main className={'page-content ' + page}>
      {page === 'home' && <Today key={profile.location} spendings={spendings} onSpendings={() => openSpendings()} location={profile.location} plans={plans} onLocation={() => setLocationOpen(true)} onAffected={() => setAffectedOpen(true)} reading={live.reading} loading={live.airLoading} error={live.airError} onRefresh={live.refreshAir} news={live.news} newsLoading={live.newsLoading} newsError={live.newsError} onRefreshNews={live.refreshNews}/>}
      {page === 'schedule' && <Schedule spendings={spendings} onSpendings={openSpendings} bookingEditor={bookingEditor} onBookingEditorOpened={() => setBookingEditor(undefined)} plans={plans} location={profile.location} onChange={changePlans} onChat={openChat} notify={notify}/>}
      {page === 'assistant' && <Assistant plans={plans} messages={messages} busy={busy} onSend={send} onRetry={message => { void send(message.retryText || '', message); }} onClear={clearChat} onReview={review}/>}
      {page === 'profile' && <Profile profile={profile} onSave={setProfile} onLocation={() => setLocationOpen(true)} onNavigate={navigate} notify={notify} onReplay={() => setOnboarding(true)}/>}
    </main>
    {spendingsOpen && <SpendingsModal plans={plans} state={spendings} initialId={spendingId} onClose={() => setSpendingsOpen(false)} onAdd={() => { setSpendingsOpen(false); setBookingEditor('new'); navigate('schedule'); }} onEdit={id => { setSpendingsOpen(false); setBookingEditor(id); navigate('schedule'); }}/>}
    <nav className="bottom-nav" aria-label="Main navigation">{[{ page: 'home' as const, title: 'Today', icon: House }, { page: 'schedule' as const, title: 'Schedule', icon: CalendarDays }, { page: 'assistant' as const, title: 'Assistant', icon: MessageCircle }, { page: 'profile' as const, title: 'Profile', icon: UserRound }].map(({ page: target, title, icon: Icon }) => <button key={target} className={page === target ? 'active' : ''} aria-current={page === target ? 'page' : undefined} onClick={() => navigate(target)}><span><Icon size={21} strokeWidth={1.6}/></span>{title}</button>)}</nav>
    {toast && <div className="toast" role="status"><Check size={17}/><span>{toast}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={17}/></button></div>}
    {locationOpen && <Modal title="Find your little corner" onClose={() => { locateRequest.current?.abort(); setLocating(false); setLocationOpen(false); }}><LocationSearch location={profile.location} onSelect={chooseLocation} onLocate={locate} locating={locating}/></Modal>}
    {affectedOpen && <Modal title={affected.length ? 'Plans worth a second look' : 'A little breathing room'} onClose={() => setAffectedOpen(false)}><p className="body-copy">{affected.length ? 'These upcoming outdoor plans overlap with higher API values in the demo outlook.' : 'No movable outdoor plans overlap with higher demo readings right now.'}</p>{affected.map(p => <div className="affected-plan" key={p.id}><span className="activity-icon run"><Footprints size={20}/></span><div><strong>{p.title}</strong><small>{p.date === TODAY ? 'Today' : p.date}, {timeLabel(p.time)}</small></div><ApiBadge api={p.api}/></div>)}<button className="button primary full" onClick={() => { setAffectedOpen(false); navigate('schedule'); }}>Review my schedule<ArrowRight size={17}/></button></Modal>}
    {scheduleChat && <Modal title={scope ? 'A better time for your plan' : 'A little help replanning'} onClose={() => { setScheduleChat(false); setScope(undefined); }}><Assistant embedded messages={messages} plans={plans} busy={busy} onSend={send} onClear={clearChat} onReview={review}/></Modal>}
    {proposals && <Modal title="A little change of plan" onClose={() => setProposals(null)}><p className="body-copy">Review each suggested change before saving. These times use the sample outlook.</p>{proposals.map(p => { const old = plans.find(a => a.id === p.id); return <div className="review-change" key={p.id}><h3>{old?.title || 'Activity'}</h3><div className="before-after"><div><span>Original</span><strong>{old?.date === TODAY ? 'Today' : old?.date}, {old ? timeLabel(old.time) : '—'}</strong>{old && <ApiBadge api={old.api} indoor={!old.outdoor}/>}</div><ArrowRight size={17}/><div><span>Suggested</span><strong>{p.date === TODAY ? 'Today' : p.date}, {timeLabel(p.time)}</strong><ApiBadge api={p.api} indoor={!p.outdoor}/></div></div><p><MapPin size={13}/>{p.location}</p><small>{p.reason}</small></div>; })}<div className="fixed-note"><LockKeyhole size={15}/>Fixed commitments stay unchanged.</div><div className="sheet-actions"><button className="button secondary" onClick={() => setProposals(null)}>Keep my plan</button><button className="button primary" onClick={() => { changePlans(applyProposals(plans, proposals)); setProposals(null); notify('Your schedule has been updated.'); navigate('schedule'); }}>Confirm {proposals.length} {proposals.length === 1 ? 'change' : 'changes'}</button></div></Modal>}
    <span className="sr-only"><Wind/>Haze Sentinel mobile preview</span>
  </div>;
}
