import { useEffect, useState, type ChangeEvent } from 'react';
import { ArrowLeft, ArrowRight, Building2, CalendarClock, Check, CheckCircle2, ChevronRight, CircleDot, CircleHelp, CircleX, Info, MapPin, Plus, RefreshCw, TriangleAlert, Wallet } from 'lucide-react';
import type { Plan } from '../ui/model';
import { dateLabel, timeLabel } from '../ui/model';
import type { EventForecast, SpendingAssessment, SpendingOption } from '../core/spendings';
import { searchStations, type StationOption } from '../services/airQuality';
import { BotanicalNote, Modal } from './Kit';
import { timestamp } from './backend';
import { bookingError, emptyBooking, money, type BookingDetails } from './spendingTypes';
import type { useSpendings } from './useSpendings';

export type SpendingsState = ReturnType<typeof useSpendings>;
const riskNames = { low: 'Lower predicted risk', moderate: 'Moderate predicted risk', high: 'High predicted risk', unknown: 'Forecast unavailable' };
const optionNames = { proceed: 'Proceed', relocate: 'Relocate', reschedule: 'Reschedule', cancel: 'Cancel' };
const optionIcons = { proceed: CircleDot, relocate: Building2, reschedule: CalendarClock, cancel: CircleX };

export function SpendingSummary({ plans, state, onOpen }: { plans: Plan[]; state: SpendingsState; onOpen: () => void }) {
  const summary = state.data?.summary;
  const booked = plans.filter(plan => plan.booking).length;
  const amount = summary?.bookingValueAtRisk;
  return <button className="spending-summary" onClick={onOpen}>
    <span className="spending-summary-icon"><Wallet size={20}/></span><span>
      <strong>{state.loading ? 'Checking your upcoming bookings…' : state.error ? 'Your booking costs need a look' : amount ? money(amount) + ' in bookings may be at risk' : 'Keep an eye on your booking costs'}</strong>
      <small>{summary?.attentionCount ? `${summary.attentionCount} upcoming ${summary.attentionCount === 1 ? 'plan' : 'plans'} · Review the costs of a change.` : booked ? `${booked} saved ${booked === 1 ? 'booking' : 'bookings'} · Review forecasts and costs.` : 'Add booking details to an activity to compare your options.'}</small>
      <small className="spending-sample">{state.error ? 'Forecast check unavailable · Tap to retry' : summary?.unknownCount ? `${summary.unknownCount} ${summary.unknownCount === 1 ? 'forecast needs' : 'forecasts need'} confirmation · All remain scheduled` : 'Next 7 days · Your plans stay scheduled'}</small>
    </span><ChevronRight size={18}/>
  </button>;
}

function ForecastNote({ forecast, attention }: { forecast?: EventForecast; attention?: boolean }) {
  const unknown = !forecast || forecast.risk === 'unknown';
  const Icon = unknown ? CircleHelp : forecast.risk === 'low' ? CheckCircle2 : TriangleAlert;
  return <div className={'spending-alert' + (unknown ? ' unknown' : forecast.risk === 'low' ? ' spending-low' : '')}>
    <strong><Icon size={15}/>{forecast ? riskNames[forecast.risk] : 'Forecast needs confirmation'}{attention && !unknown ? ' · Needs attention' : ''}</strong>
    <p>{forecast?.reason || 'Check the forecast for this activity’s location. Your booking remains scheduled.'}</p>
    {forecast?.index != null && <p>Daily PM2.5 / PM10 maximum: {forecast.index} forecast index · {forecast.period.map(day => dateLabel(day, true)).join(' / ')}.</p>}
    {forecast && <><small>{forecast.station || 'Station unavailable'} · {forecast.source}</small><small>Forecast updated: {forecast.forecastUpdatedAt ? timestamp(forecast.forecastUpdatedAt) : 'Unavailable from this feed'}</small><small>Last checked: {timestamp(forecast.checkedAt)} · Observation: {timestamp(forecast.observedAt)}</small></>}
  </div>;
}

function OptionCard({ option, cheapest }: { option: SpendingOption; cheapest: boolean }) {
  const Icon = optionIcons[option.id];
  return <article className={'spending-option ' + (cheapest ? 'recommended' : !option.feasible ? 'unavailable' : '')}>
    <h3><Icon size={15}/>{optionNames[option.id]}</h3><strong>{money(option.cost)}</strong>
    <p>{option.cost == null ? 'Cost needs confirmation.' : option.breakdown.filter(part => part.amount !== 0).map(part => `${money(part.amount)} ${part.label.toLowerCase()}`).join(' + ') || 'No cash cost entered.'}</p>
    <small>{cheapest ? <CheckCircle2 size={11}/> : option.feasible ? <Check size={11}/> : <TriangleAlert size={11}/>} {cheapest ? 'Lowest cost feasible option' : option.feasible ? 'Feasible on the entered terms' : 'Needs confirmation or unsuitable'}</small>
    <p>{option.reason}</p>
    {option.incomeAtRisk > 0 && <p>Estimated income forgone: {money(option.incomeAtRisk)}, separate from the cash cost.</p>}
  </article>;
}

export function SpendingsModal({ plans, state, initialId, onClose, onEdit, onAdd }: { plans: Plan[]; state: SpendingsState; initialId?: string; onClose: () => void; onEdit: (id: string) => void; onAdd: () => void }) {
  const [selectedId, setSelectedId] = useState(initialId);
  const [review, setReview] = useState(false);
  const selected = plans.find(plan => plan.id === selectedId && plan.booking);
  const booked = plans.filter(plan => plan.booking).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const assessment = selected ? state.data?.assessments.find(item => item.id === selected.id) : undefined;
  const summary = state.data?.summary;
  const cheapest = assessment?.options.find(option => option.id === assessment.cheapest);
  const keepActivity = assessment?.options.filter(option => option.id !== 'cancel' && option.feasible && option.cost != null).sort((a, b) => a.cost! - b.cost!)[0];
  return <Modal title={selected ? selected.title : 'Your upcoming spendings'} onClose={onClose}>
    {state.error && <div className="live-notice" role="alert"><p>{state.error}</p><button className="text-button" onClick={state.refresh}>Try again</button></div>}
    {state.loading && <p className="body-copy" role="status">Checking locations, forecasts and booking costs…</p>}
    {!selected ? <>
      <p className="body-copy">A little care for the plans you’ve paid for.</p>
      <section className="spending-exposure"><span><Wallet size={16}/>Potential money at risk</span><strong>{summary && (!summary.upcomingCount || summary.upcomingCount > summary.unknownCount) ? money(summary.bookingValueAtRisk) : '—'}</strong><p>Booking value during elevated daily forecast conditions over the next 7 days. This is exposure, not a confirmed loss.</p><small>{summary?.attentionCount ?? 0} plans need attention · All remain scheduled</small></section>
      <p className="spending-data-note"><Info size={12}/>{state.data ? `Last checked ${timestamp(state.data.checkedAt)}` : 'Forecast and costs will appear after a successful check.'}</p>
      {!!summary?.unknownCount && <p className="body-copy">{summary.unknownCount} upcoming {summary.unknownCount === 1 ? 'booking has' : 'bookings have'} an unavailable forecast and {summary.unknownCount === 1 ? 'is' : 'are'} excluded from the amount above. Unknown risk is not zero risk.</p>}
      <div className="spending-bookings">{booked.map(plan => {
        const item = state.data?.assessments.find(result => result.id === plan.id);
        return <button key={plan.id} className={'spending-booking ' + (item?.needsAttention ? 'affected' : '')} onClick={() => { setSelectedId(plan.id); setReview(false); }}>
          <span className="activity-icon"><Wallet size={19}/></span><span><small>{dateLabel(plan.date, true)} · {timeLabel(plan.time)}</small><strong>{plan.title}</strong><small><MapPin size={11}/>{plan.location}</small><span className={'spending-risk ' + (item?.needsAttention ? 'high' : 'unknown')}><RiskIcon item={item}/>{item ? riskNames[item.forecast.risk] : 'Forecast needs confirmation'}{item?.needsAttention ? ' · Needs attention' : ''}</span><small>{money(plan.booking!.deposit)} deposit · {plan.booking?.refund === 'nonrefundable' ? 'Non-refundable' : plan.booking?.refund === 'refundable' ? 'Refundable on entered terms' : 'Terms unknown'}</small></span><span className="spending-booking-price">{money(plan.booking!.total)}<ChevronRight size={15}/></span>
        </button>;
      })}</div>
      {!booked.length && <p className="body-copy">Add a booking to a new or existing activity. Your other plans stay in Schedule.</p>}
      <button className="button primary full" onClick={onAdd}><Plus size={16}/>Add a booked activity</button>
      {summary && (summary.operatingCostsAtRisk > 0 || summary.incomeAtRisk > 0 || summary.depositsAtRisk > 0) && <p className="fine-print">Non-refundable deposits at risk: {money(summary.depositsAtRisk)} (already included in booking value).<br/>Additional operating costs at risk: {money(summary.operatingCostsAtRisk)}.<br/>Estimated income at risk: {money(summary.incomeAtRisk)}. These figures are separate; avoid counting a cost twice.</p>}
      <p className="fine-print">Activities and booking terms are saved in this browser. Forecast checks do not cancel bookings or contact venues.</p><BotanicalNote>Your plans stay yours to change.</BotanicalNote>
    </> : <>
      <button className="text-button spending-back" onClick={() => { setSelectedId(undefined); setReview(false); }}><ArrowLeft size={14}/>All upcoming spendings</button>
      <div className="spending-event-context"><span>{dateLabel(selected.date, true)} · {timeLabel(selected.time)} · {selected.duration} min</span><span><MapPin size={12}/>{selected.location}</span><span className="spending-scheduled"><Check size={11}/>Scheduled</span></div>
      {review ? <>
        <p className="body-copy"><strong>{cheapest ? `Lowest feasible cash cost: ${optionNames[cheapest.id].toLowerCase()} for ${money(cheapest.cost)}.` : 'No option can be recommended yet.'}</strong><br/>{cheapest?.reason || 'Confirm the forecast, availability and booking terms before deciding.'}</p>
        {keepActivity && keepActivity.id !== cheapest?.id && <p className="body-copy"><strong>Prefer to keep the activity?</strong><br/>{optionNames[keepActivity.id]} for {money(keepActivity.cost)} based on the entered terms.</p>}
        <p className="fine-print">Confirm the arrangements with your venue. Reviewing costs doesn’t contact the venue, cancel your booking, or change your schedule.</p>
        <div className="sheet-actions"><button className="button secondary" onClick={() => onEdit(selected.id)}>Edit activity</button><button className="button primary" onClick={onClose}>Keep event scheduled<Check size={16}/></button></div>
      </> : <>
        <ForecastNote forecast={assessment?.forecast} attention={assessment?.needsAttention}/>
        <div className="spending-paid"><div><span>Booking</span><strong>{money(selected.booking!.total)}</strong></div><div><span>Deposit paid</span><strong>{money(selected.booking!.deposit)}</strong></div><div><span>Still to pay</span><strong>{money(Math.round((selected.booking!.total - selected.booking!.deposit) * 100) / 100)}</strong></div></div>
        <div className="spending-cost-heading"><h2>Find your better option.</h2><p>Total out of pocket, including what you’ve paid and additional operating costs. Income is shown separately.</p></div>
        {assessment ? <div className="spending-options">{assessment.options.map(option => <OptionCard key={option.id} option={option} cheapest={option.id === assessment.cheapest}/>)}</div> : <p className="body-copy">No current quote is available. Retry the check or edit your booking details.</p>}
        {assessment?.alternativeForecast && <details className="spending-alternative"><summary>Forecast for the alternative time</summary><ForecastNote forecast={assessment.alternativeForecast}/></details>}
        <p className="fine-print">Daily model forecasts cannot establish exact-hour conditions or personal safety. WAQI AQI differs from Malaysia’s API/IPU. Recheck official advisories nearer the event.</p>
        {assessment?.forecast.stationUrl && /^https:\/\//.test(assessment.forecast.stationUrl) && <a className="text-button spending-source" href={assessment.forecast.stationUrl} target="_blank" rel="noreferrer">View forecast station on WAQI<ArrowRight size={13}/></a>}
        <div className="sheet-actions"><button className="button secondary" onClick={() => onEdit(selected.id)}>Edit booking</button><button className="button primary" onClick={() => setReview(true)}>Review my options<ArrowRight size={16}/></button></div>
      </>}
    </>}
    <button className="text-button spending-refresh" disabled={state.loading} onClick={state.refresh}><RefreshCw size={13}/>{state.loading ? 'Checking…' : 'Refresh forecasts & costs'}</button>
  </Modal>;
}

function RiskIcon({ item }: { item?: SpendingAssessment }) { return item?.needsAttention && item.forecast.risk !== 'unknown' ? <TriangleAlert size={11}/> : <CircleHelp size={11}/>; }

function ForecastLocation({ value, onChange }: { value: BookingDetails; onChange: (value: BookingDetails) => void }) {
  const [stations, setStations] = useState<StationOption[]>([]);
  const [status, setStatus] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setStations([]); setStatus('');
    if (value.forecastStationId || value.forecastLocation.trim().length < 2) return () => controller.abort();
    const timer = setTimeout(() => {
      setStatus('Searching monitoring stations…');
      void searchStations(value.forecastLocation.trim(), controller.signal).then(items => { if (!controller.signal.aborted) { setStations(items.slice(0, 5)); setStatus(items.length ? 'Choose a monitoring station, or use the city name.' : 'No station matches. The city will be looked up when you save.'); } }).catch(() => { if (!controller.signal.aborted) setStatus('Station search is unavailable. You can still save a city for the forecast check.'); });
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [value.forecastLocation, value.forecastStationId]);
  return <><label>Forecast city or monitoring station<input maxLength={120} value={value.forecastLocation} onChange={event => onChange({ ...value, forecastLocation: event.target.value, forecastStationId: '' })} placeholder="e.g. Kuala Lumpur"/></label><p className="fine-print">Choose the city or station nearest the venue. The forecast uses this location, independently of Today’s selected area.</p>{status && <p className="fine-print" role="status">{status}</p>}{value.forecastStationId && <p className="fine-print">Monitoring station selected · {value.forecastStationId}</p>}{stations.length > 0 && <div className="spending-stations">{stations.map(station => <button type="button" key={station.stationId} onClick={() => { setStations([]); onChange({ ...value, forecastLocation: station.name, forecastStationId: station.stationId }); }}><MapPin size={13}/>{station.name}<ChevronRight size={13}/></button>)}</div>}</>;
}

export function BookingFields({ value, onChange, initiallyOpen = false, defaultLocation = '' }: { value?: BookingDetails; onChange: (value: BookingDetails | undefined) => void; initiallyOpen?: boolean; defaultLocation?: string }) {
  const update = <K extends keyof BookingDetails>(key: K, next: BookingDetails[K]) => onChange({ ...value!, [key]: next });
  const amount = (key: 'total' | 'deposit' | 'changeFee' | 'indoorCost' | 'relocationFee' | 'cancelFee' | 'operatingCost' | 'expectedIncome', optional = false) => ({ type: 'number', min: 0, max: 10000000, step: '0.01', required: !optional, value: value?.[key] ?? '', placeholder: optional ? 'Unknown' : undefined, onChange: (event: ChangeEvent<HTMLInputElement>) => update(key, event.target.value === '' && optional ? null : Number(event.target.value)) });
  const toggle = (key: 'indoorConfirmed' | 'currentIndoorConfirmed' | 'alternativeConfirmed' | 'depositTransfers' | 'rescheduleDepositTransfers', label: string) => <label className="checkbox-row"><input type="checkbox" checked={value![key]} onChange={event => update(key, event.target.checked)}/><span>{label}</span></label>;
  return <details className="spending-fields" open={initiallyOpen || undefined}><summary><Wallet size={16}/>Booking & costs <span>(optional)</span></summary>
    <label className="checkbox-row"><input type="checkbox" checked={!!value} onChange={event => onChange(event.target.checked ? { ...emptyBooking, forecastLocation: defaultLocation } : undefined)}/><span>Track the cost of this activity</span></label>
    {value && <>
      <div className="form-row"><label>Total booking cost (RM)<input {...amount('total')}/></label><label>Deposit paid (RM)<input {...amount('deposit')}/></label></div>
      <p className="fine-print">The deposit is part of the total booking cost. If fully paid, enter the full amount in both fields.</p>
      <div className="form-row"><label>Deposit policy<select value={value.refund} onChange={event => update('refund', event.target.value as BookingDetails['refund'])}><option value="unknown">Unknown</option><option value="nonrefundable">Non-refundable</option><option value="refundable">Fully refundable</option></select></label><label>Change fee (RM)<input {...amount('changeFee', true)}/></label></div>
      <ForecastLocation value={value} onChange={onChange}/>
      <label>Booking reference<input maxLength={120} value={value.reference} onChange={event => update('reference', event.target.value)} placeholder="Optional · stays in this browser"/></label>
      <label>Change / cancellation deadline (MYT)<input type="datetime-local" value={value.deadline} onChange={event => update('deadline', event.target.value)}/></label>
      <label>Booking terms<textarea maxLength={2000} rows={2} value={value.terms} onChange={event => update('terms', event.target.value)} placeholder="Refund rules, deposit transfer, balance due…"/></label>
      <details><summary>Cancellation terms</summary><label>Cancellation fee beyond deposit (RM)<input {...amount('cancelFee', true)}/></label><label>Unpaid balance if cancelled<select value={value.cancelBalance} onChange={event => update('cancelBalance', event.target.value as BookingDetails['cancelBalance'])}><option value="unknown">Unknown</option><option value="waived">Waived by venue</option><option value="due">Still payable in full</option></select></label><p className="fine-print">Enter 0 only when you’ve confirmed there is no fee. Blank fees stay unknown.</p></details>
      <details><summary>Alternative costs & availability</summary>
        <div className="form-row"><label>Indoor venue total (RM)<input {...amount('indoorCost', true)}/></label><label>Relocation fee (RM)<input {...amount('relocationFee', true)}/></label></div>
        {toggle('indoorConfirmed', 'Indoor alternative availability, air and exposure controls confirmed')}
        {toggle('depositTransfers', 'Deposit is credited toward the indoor venue total')}
        <div className="form-row"><label>Alternative date<input type="date" value={value.alternativeDate} onChange={event => update('alternativeDate', event.target.value)}/></label><label>Alternative time (MYT)<input type="time" value={value.alternativeTime} onChange={event => update('alternativeTime', event.target.value)}/></label></div>
        {toggle('alternativeConfirmed', 'Alternative time and venue availability confirmed')}
        {toggle('rescheduleDepositTransfers', 'Deposit transfers when rescheduling')}
        {toggle('currentIndoorConfirmed', 'Current indoor venue air and exposure controls confirmed')}
        <p className="fine-print">Rescheduling keeps the same venue and booking price, plus your entered change fee. Relocation settles the old booking using its cancellation terms.</p>
      </details>
      <details><summary>Operating costs & income</summary><div className="form-row"><label>Additional operating costs (RM)<input {...amount('operatingCost')}/></label><label>Expected income (RM)<input {...amount('expectedIncome')}/></label></div><p className="fine-print">Operating costs are additional avoidable costs if the activity goes ahead, relocates or reschedules. Income is tracked separately and assumed forgone on cancellation. Exclude costs already in the booking price.</p></details>
      {bookingError(value) && <p className="form-error">{bookingError(value)}</p>}
      <p className="fine-print">Confirmed terms and availability determine which options can be compared. Your activity stays scheduled.</p>
    </>}
  </details>;
}
