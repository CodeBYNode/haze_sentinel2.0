import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BookingFields, SpendingSummary } from './Spendings';
import { emptyBooking, restoredBooking, bookingError } from './spendingTypes';
import { initialPlans } from '../ui/model';

describe('Booking details and old activities', () => {
  it('keeps booking entry optional with empty and unknown fee states', () => {
    const html = renderToStaticMarkup(<BookingFields value={emptyBooking} onChange={() => {}}/>);
    expect(html).toContain('Booking &amp; costs'); expect(html).toContain('(optional)');
    expect(html).toContain('Unknown'); expect(html).toContain('Forecast city or monitoring station');
    expect(html).toContain('Unpaid balance if cancelled');
  });
  it('recovers invalid optional booking details without rejecting the activity', () => {
    expect(restoredBooking(undefined)).toBeUndefined();
    expect(restoredBooking({ ...emptyBooking, terms: null })).toBeUndefined();
    expect(restoredBooking({ ...emptyBooking, deposit: 200 })).toBeUndefined();
    expect(restoredBooking(emptyBooking)).toEqual(emptyBooking);
    expect(bookingError({ ...emptyBooking, total: 120, deposit: 50 })).toBe('');
  });
  it('shows an additive summary without claiming an amount or risk from sample plan API values', () => {
    const html = renderToStaticMarkup(<SpendingSummary plans={initialPlans} onOpen={() => {}} state={{ data: null, loading: false, error: '', refresh() {} }}/>);
    expect(html).toContain('Add booking details'); expect(html).not.toContain('RM240');
    expect(html).toContain('Your plans stay scheduled');
  });
});
