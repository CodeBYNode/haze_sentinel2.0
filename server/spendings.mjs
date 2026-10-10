import { assessSpendings, SpendingValidationError, validateSpendingEvents, validateSpendingCalendar } from './lib/spendings.mjs';

export async function handleSpendings(req, res, { waqi, jsonBody, json }) {
  let body;
  try { body = await jsonBody(req); }
  catch { return json(res, 400, { error: 'Request body must be valid JSON and under 160 KB.' }); }
  try {
    const events = validateSpendingEvents(body);
    // Include unbooked activities for overlap checks without sending their titles,
    // location, booking reference, terms, or any personal details to the provider.
    const calendar = validateSpendingCalendar(body.calendar, events.map(event => event.id));
    const all = [...events, ...calendar];
    const controller = new AbortController();
    const disconnected = () => controller.abort();
    res.once('close', disconnected);
    try {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(35000)]);
      const result = await assessSpendings(events, { feed: where => waqi.feed(where, signal), calendar: all });
      if (!res.destroyed) return json(res, 200, result);
    } finally { res.off('close', disconnected); }
  } catch (error) {
    if (error instanceof SpendingValidationError) return json(res, 400, { error: error.message });
    throw error;
  }
}
