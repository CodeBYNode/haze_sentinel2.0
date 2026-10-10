import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSpendings } from './spendings';
import { initialPlans } from '../ui/model';
import { emptyBooking } from '../mobile/spendingTypes';

afterEach(() => vi.unstubAllGlobals());
describe('Spendings API client', () => {
  it('sends booked events and calendar separately, excluding reference, terms and activity title', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ checkedAt: '2026-10-11T00:00:00Z', assessments: [], summary: {} })));
    vi.stubGlobal('fetch', fetchMock);
    await getSpendings([{ ...initialPlans[0], title: 'Private title', booking: { ...emptyBooking, reference: 'private-ref', terms: 'private-terms' } }, initialPlans[1]]);
    const [url, request] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/spendings/assess'); expect(request.method).toBe('POST'); expect(request.cache).toBe('no-store');
    const body = JSON.parse(request.body as string);
    expect(body.events).toHaveLength(1); expect(body.calendar).toEqual([{ id: initialPlans[1].id, date: initialPlans[1].date, time: initialPlans[1].time, duration: initialPlans[1].duration }]);
    expect(request.body).not.toContain('private-ref'); expect(request.body).not.toContain('private-terms'); expect(request.body).not.toContain('Private title');
  });
  it('surfaces validation and transport failures without returning stale quotes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Invalid deposit' }), { status: 400 })));
    await expect(getSpendings([])).rejects.toThrow('Invalid deposit');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('invalid json')));
    await expect(getSpendings([])).rejects.toThrow('invalid response');
  });
});
