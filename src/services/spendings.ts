import type { Plan } from '../ui/model';
import type { SpendingsResponse } from '../core/spendings';

export async function getSpendings(plans: Plan[], signal?: AbortSignal): Promise<SpendingsResponse> {
  const booked = plans.filter(plan => plan.booking);
  if (booked.length > 30) throw new Error('You can assess up to 30 booked activities at a time. Your saved activities are unchanged.');
  const events = booked.map(({ id, date, time, duration, location, outdoor, fixed, kind, booking }) => {
    // Reference and free-text terms are saved locally and excluded from requests.
    const { reference: _reference, terms: _terms, ...costs } = booking!;
    return { id, date, time, duration, location, outdoor, fixed, kind, booking: { ...costs, reference: '', terms: '' } };
  });
  const calendar = plans.filter(plan => !plan.booking).map(({ id, date, time, duration }) => ({ id, date, time, duration }));
  const res = await fetch('/api/spendings/assess', { method: 'POST', signal, cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ events, calendar }) });
  let body;
  try { body = await res.json(); } catch { throw new Error('The cost service returned an invalid response. Try again.'); }
  if (!res.ok) throw new Error(body?.error || 'Booking assessment is unavailable. Try again.');
  if (!body || !Array.isArray(body.assessments) || !body.summary || typeof body.checkedAt !== 'string') throw new Error('The cost service returned incomplete data. Try again.');
  return body;
}
