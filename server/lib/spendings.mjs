// Booking records stay in the existing browser-local schedule. This module only
// validates a bounded request and calculates a fresh, non-persisted assessment.
export class SpendingValidationError extends Error {}
const amountKeys = ['total', 'deposit', 'changeFee', 'indoorCost', 'relocationFee', 'cancelFee', 'operatingCost', 'expectedIncome'];
const optionalAmounts = new Set(['changeFee', 'indoorCost', 'relocationFee', 'cancelFee']);
const booleanKeys = ['indoorConfirmed', 'currentIndoorConfirmed', 'alternativeConfirmed', 'depositTransfers', 'rescheduleDepositTransfers'];
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
const validTime = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const cents = value => Math.round(value * 100);
const sum = values => values.reduce((total, value) => total + cents(value), 0) / 100;
const text = (value, max) => typeof value === 'string' && value.length <= max;
const startTime = event => Date.parse(`${event.date}T${event.time}:00+08:00`);
export function malaysiaDate(now) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

export function validateSpendingEvents(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Array.isArray(body.events) || body.events.length > 30) throw new SpendingValidationError('Send at most 30 booked activities per request.');
  const ids = new Set();
  return body.events.map(event => {
    if (!event || !text(event.id, 120) || !event.id || ids.has(event.id) || !validDate(event.date) || !validTime(event.time) || !Number.isInteger(event.duration) || event.duration < 1 || event.duration > 1440 || !text(event.location, 120) || !event.location.trim() || typeof event.outdoor !== 'boolean' || typeof event.fixed !== 'boolean') throw new SpendingValidationError('Each activity needs a unique ID, valid date, time, duration and location.');
    ids.add(event.id);
    const b = event.booking;
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw new SpendingValidationError('Add booking details to each activity.');
    for (const key of amountKeys) {
      if (optionalAmounts.has(key) && b[key] === null) continue;
      if (typeof b[key] !== 'number' || !Number.isFinite(b[key]) || b[key] < 0 || b[key] > 10000000 || Math.abs(b[key] * 100 - cents(b[key])) > 0.00001) throw new SpendingValidationError('Costs must be non-negative RM amounts with at most two decimal places. Leave unknown fees blank.');
    }
    if (cents(b.deposit) > cents(b.total)) throw new SpendingValidationError('The deposit cannot exceed the total booking cost.');
    if (!['unknown', 'nonrefundable', 'refundable'].includes(b.refund) || !['unknown', 'waived', 'due'].includes(b.cancelBalance) || booleanKeys.some(key => typeof b[key] !== 'boolean')) throw new SpendingValidationError('Choose valid booking policies and confirmations.');
    if (!text(b.reference, 120) || !text(b.terms, 2000) || !text(b.forecastLocation, 120) || !text(b.forecastStationId, 20) || (b.forecastStationId && !/^\d+$/.test(b.forecastStationId))) throw new SpendingValidationError('Booking reference, terms or forecast location is invalid.');
    if (!text(b.deadline, 16) || (b.deadline && (!validDate(b.deadline.slice(0, 10)) || b.deadline[10] !== 'T' || !validTime(b.deadline.slice(11))))) throw new SpendingValidationError('Choose a valid change / cancellation deadline in Malaysia time.');
    if (!text(b.alternativeDate, 10) || !text(b.alternativeTime, 5) || (b.alternativeDate && !validDate(b.alternativeDate)) || (b.alternativeTime && !validTime(b.alternativeTime)) || (b.alternativeConfirmed && (!validDate(b.alternativeDate) || !validTime(b.alternativeTime)))) throw new SpendingValidationError('A confirmed alternative needs a valid date and time.');
    // Keep the outbound provider context separate from booking details and identity.
    return { id: event.id, date: event.date, time: event.time, duration: event.duration, location: event.location.trim(), outdoor: event.outdoor, fixed: event.fixed, kind: typeof event.kind === 'string' ? event.kind : 'other', booking: { ...b, forecastLocation: b.forecastLocation.trim() } };
  });
}

export function validateSpendingCalendar(value, bookedIds = []) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 300) throw new SpendingValidationError('Send at most 300 calendar activities.');
  return value.filter(item => !bookedIds.includes(item?.id)).map(item => {
    if (!item || !text(item.id, 120) || !item.id || !validDate(item.date) || !validTime(item.time) || !Number.isInteger(item.duration) || item.duration < 1 || item.duration > 1440) throw new SpendingValidationError('Calendar activities need a valid ID, date, time and duration.');
    return { id: item.id, date: item.date, time: item.time, duration: item.duration };
  });
}

function eventDays(event) {
  const end = startTime(event) + event.duration * 60000 - 1;
  return [...new Set([event.date, malaysiaDate(new Date(end))])];
}

export function assessEventForecast(event, reading, now = new Date(), providerError = '') {
  const result = { risk: 'unknown', index: null, period: eventDays(event), station: reading?.station || null, stationUrl: reading?.stationUrl || null, source: 'World Air Quality Index Project (WAQI)', observedAt: reading?.observedAt || null, forecastUpdatedAt: null, checkedAt: now.toISOString(), reason: '' };
  if (providerError || !reading) return { ...result, reason: providerError || 'No forecast is available for this location.' };
  const observed = reading.observedAt ? Date.parse(reading.observedAt) : NaN;
  if (!Number.isFinite(observed) || now.getTime() - observed > 2 * 3600000 || observed > now.getTime() + 5 * 60000) return { ...result, reason: 'The provider observation is stale or its timestamp is unavailable. Recheck the forecast.' };
  if (startTime(event) + event.duration * 60000 <= now.getTime()) return { ...result, reason: 'This activity has already ended.' };
  const maxima = [];
  for (const day of result.period) {
    const rows = ['pm25', 'pm10'].flatMap(key => Array.isArray(reading.forecast?.[key]) ? reading.forecast[key].filter(row => row?.day === day) : []);
    const valid = rows.filter(row => [row.min, row.avg, row.max].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0) && row.min <= row.avg && row.avg <= row.max);
    if (!valid.length) return { ...result, reason: `No usable PM2.5 / PM10 daily forecast covers ${day}. Exact-hour conditions are unavailable.` };
    maxima.push(...valid.map(row => row.max));
  }
  const index = Math.max(...maxima);
  return { ...result, index, risk: index <= 50 ? 'low' : index <= 100 ? 'moderate' : 'high', reason: 'Daily maximum forecast index for the activity date, including the next day if it crosses midnight. It does not predict conditions at the exact hour.' };
}

export function compareSpendingOptions(event, forecast, alternativeForecast, now = new Date(), events = []) {
  const b = event.booking;
  const deadlinePassed = Boolean(b.deadline && Date.parse(b.deadline + ':00+08:00') <= now.getTime());
  const lostDeposit = b.deposit === 0 || b.refund === 'refundable' ? 0 : b.refund === 'nonrefundable' ? b.deposit : null;
  const add = (label, amount) => ({ label, amount });
  const option = (id, breakdown, feasible, reason, incomeAtRisk = 0) => ({ id, cost: breakdown ? sum(breakdown.map(part => part.amount)) : null, breakdown: breakdown || [], feasible: Boolean(feasible && breakdown), reason, incomeAtRisk });
  const proceedAllowed = event.outdoor ? forecast.risk === 'low' : b.currentIndoorConfirmed;
  const proceedReason = event.outdoor ? forecast.risk === 'high' ? 'Outdoor activity is unsuitable in the predicted conditions.' : forecast.risk === 'moderate' ? 'Outdoor exposure and exertion need review before proceeding.' : forecast.risk === 'unknown' ? 'Forecast unavailable; outdoor feasibility is unknown.' : 'Lower daily risk; recheck conditions and official guidance before leaving.' : b.currentIndoorConfirmed ? 'Indoor venue and exposure controls confirmed by you.' : 'Confirm indoor air and exposure controls before proceeding.';
  const proceed = option('proceed', [add('Deposit already paid', b.deposit), add('Booking balance', sum([b.total, -b.deposit])), add('Additional operating costs', b.operatingCost)], proceedAllowed, proceedReason);
  const balanceKnown = b.cancelBalance !== 'unknown' || b.total === b.deposit;
  const oldBalance = b.cancelBalance === 'due' ? sum([b.total, -b.deposit]) : 0;
  const canSettle = lostDeposit !== null && balanceKnown && b.cancelFee !== null && !deadlinePassed;
  const cancelParts = canSettle ? [add('Forfeited deposit', lostDeposit), add('Cancellation fee', b.cancelFee), add('Original balance still payable', oldBalance)] : null;
  const cancel = option('cancel', cancelParts, canSettle, deadlinePassed ? 'The booking deadline has passed. Reconfirm the cancellation terms and fees.' : canSettle ? 'Based on your entered terms; confirm cancellation with the venue yourself.' : 'Confirm deposit policy, cancellation fee and whether the unpaid balance is waived.', b.expectedIncome);
  const relocateParts = canSettle && b.indoorCost !== null && b.relocationFee !== null ? [add(b.depositTransfers ? 'Deposit credited to new venue' : 'Forfeited deposit', b.depositTransfers ? 0 : lostDeposit), add('Original cancellation fee', b.cancelFee), add('Original balance still payable', oldBalance), add(b.depositTransfers ? 'Indoor venue (includes credited deposit; unused credit assumed lost)' : 'Indoor venue total', b.depositTransfers ? Math.max(b.indoorCost, b.deposit) : b.indoorCost), add('Relocation fee', b.relocationFee), add('Additional operating costs', b.operatingCost)] : null;
  const relocate = option('relocate', relocateParts, b.indoorConfirmed, deadlinePassed ? 'The booking deadline has passed. Reconfirm relocation terms.' : !relocateParts ? 'Confirm original cancellation terms, indoor venue cost and relocation fee.' : !b.indoorConfirmed ? 'Confirm the indoor venue’s availability, air and exposure controls.' : 'Indoor venue and exposure controls confirmed by you.');
  const alternative = { ...event, date: b.alternativeDate, time: b.alternativeTime };
  const sameTime = b.alternativeDate === event.date && b.alternativeTime === event.time;
  const conflicts = b.alternativeConfirmed && events.some(other => other.id !== event.id && startTime(other) < startTime(alternative) + event.duration * 60000 && startTime(alternative) < startTime(other) + other.duration * 60000);
  const alternativeAllowed = b.alternativeConfirmed && !sameTime && startTime(alternative) > now.getTime() && !conflicts && !event.fixed && (event.outdoor ? alternativeForecast?.risk === 'low' : b.currentIndoorConfirmed);
  const rescheduleParts = b.changeFee !== null && (b.rescheduleDepositTransfers || lostDeposit !== null) && !deadlinePassed ? [add(b.rescheduleDepositTransfers ? 'Booking total (includes transferred deposit)' : 'Booking total at new time', b.total), add('Deposit lost on change', b.rescheduleDepositTransfers ? 0 : lostDeposit), add('Change fee', b.changeFee), add('Additional operating costs', b.operatingCost)] : null;
  const reschedule = option('reschedule', rescheduleParts, alternativeAllowed, deadlinePassed ? 'The booking deadline has passed. Reconfirm change terms.' : event.fixed ? 'Fixed activity; change its time manually in Schedule.' : !b.alternativeConfirmed ? 'Enter and confirm an alternative date and time.' : sameTime ? 'Choose a different date or time.' : conflicts ? 'The alternative overlaps another activity.' : startTime(alternative) <= now.getTime() ? 'The alternative time is in the past.' : !rescheduleParts ? 'Confirm the change fee and deposit transfer or refund policy.' : !alternativeAllowed ? 'The alternative forecast or exposure controls do not establish feasibility.' : 'Alternative confirmed with lower daily risk and no calendar overlap.');
  return [proceed, relocate, reschedule, cancel];
}

export async function assessSpendings(events, { feed, now = new Date(), calendar = events } = {}) {
  const checkedAt = now.toISOString();
  const horizonEnd = new Date(now.getTime() + 7 * 86400000).toISOString();
  // Only coalesce lookups within this request; provider readings are never cached.
  const feeds = new Map();
  const lookup = event => {
    const where = event.booking.forecastStationId ? { stationId: event.booking.forecastStationId } : { location: event.booking.forecastLocation || event.location };
    const key = JSON.stringify(where);
    if (!feeds.has(key)) feeds.set(key, Promise.resolve().then(() => feed(where)).then(reading => ({ reading, error: '' }), error => ({ reading: null, error: typeof error?.message === 'string' ? error.message : 'The forecast provider is unavailable.' })));
    return feeds.get(key);
  };
  const assessments = new Array(events.length);
  const assess = async event => {
    const upcoming = startTime(event) + event.duration * 60000 > now.getTime() && startTime(event) <= Date.parse(horizonEnd);
    const data = upcoming ? await lookup(event) : { reading: null, error: 'Outside the next seven days. This booking remains saved; check again nearer the event.' };
    const forecast = assessEventForecast(event, data.reading, now, data.error);
    const b = event.booking;
    const alternativeForecast = b.alternativeConfirmed ? assessEventForecast({ ...event, date: b.alternativeDate, time: b.alternativeTime }, data.reading, now, data.error) : null;
    const options = compareSpendingOptions(event, forecast, alternativeForecast, now, calendar);
    const feasible = options.filter(option => option.feasible && option.cost !== null).sort((a, b) => cents(a.cost) - cents(b.cost));
    const needsAttention = upcoming && (forecast.risk !== 'low') && (event.outdoor || !b.currentIndoorConfirmed);
    return { id: event.id, status: 'scheduled', upcoming, needsAttention, forecast, alternativeForecast, options, cheapest: feasible[0]?.id || null };
  };
  // At most three lookups run concurrently, including requests coalesced by place.
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(3, events.length) }, async () => {
    while (cursor < events.length) { const index = cursor++; assessments[index] = await assess(events[index]); }
  }));
  const attention = assessments.filter(a => a.needsAttention && a.forecast.risk !== 'unknown');
  const affected = attention.map(a => events.find(e => e.id === a.id).booking);
  return { checkedAt, horizonEnd, assessments, summary: {
    bookingValueAtRisk: sum(affected.map(b => b.total)),
    depositsAtRisk: sum(affected.map(b => b.refund === 'nonrefundable' ? b.deposit : 0)),
    operatingCostsAtRisk: sum(affected.map(b => b.operatingCost)),
    incomeAtRisk: sum(affected.map(b => b.expectedIncome)),
    attentionCount: attention.length,
    unknownCount: assessments.filter(a => a.upcoming && a.forecast.risk === 'unknown').length,
    upcomingCount: assessments.filter(a => a.upcoming).length,
  } };
}
