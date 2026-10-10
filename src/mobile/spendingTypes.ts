import type { BookingDetails } from '../core/spendings';
export type { BookingDetails } from '../core/spendings';

export const emptyBooking: BookingDetails = {
  total: 0, deposit: 0, refund: 'unknown', changeFee: null, indoorCost: null,
  relocationFee: null, cancelFee: null, cancelBalance: 'unknown', reference: '', terms: '', deadline: '',
  forecastLocation: '', forecastStationId: '', indoorConfirmed: false, currentIndoorConfirmed: false,
  alternativeConfirmed: false, alternativeDate: '', alternativeTime: '', depositTransfers: false,
  rescheduleDepositTransfers: false, operatingCost: 0, expectedIncome: 0,
};
export function money(value: number | null | undefined) {
  return value == null ? 'Unknown' : 'RM' + value.toLocaleString('en-MY', { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(value) ? 0 : 2 });
}
export function bookingError(value?: BookingDetails) {
  if (!value) return '';
  const required = [value.total, value.deposit, value.operatingCost, value.expectedIncome];
  const optional = [value.changeFee, value.indoorCost, value.relocationFee, value.cancelFee];
  if ([...required, ...optional.filter(v => v !== null)].some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 10000000 || Math.abs(v * 100 - Math.round(v * 100)) > .00001)) return 'Enter non-negative RM amounts with at most two decimal places. Leave unknown fees blank.';
  if (value.deposit > value.total) return 'The deposit cannot exceed the total booking cost.';
  if (value.alternativeConfirmed && (!value.alternativeDate || !value.alternativeTime)) return 'Add the alternative date and time before confirming it.';
  if (value.terms.length > 2000 || value.reference.length > 120) return 'Keep the reference within 120 characters and terms within 2,000 characters.';
  return '';
}

// Invalid optional booking data must never discard an otherwise valid old plan.
export function restoredBooking(value: unknown): BookingDetails | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const b = { ...emptyBooking, ...value } as BookingDetails;
  for (const key of ['reference', 'terms', 'deadline', 'forecastLocation', 'forecastStationId', 'alternativeDate', 'alternativeTime'] as const) if (typeof b[key] !== 'string') return undefined;
  for (const key of ['indoorConfirmed', 'currentIndoorConfirmed', 'alternativeConfirmed', 'depositTransfers', 'rescheduleDepositTransfers'] as const) if (typeof b[key] !== 'boolean') return undefined;
  if (bookingError(b) || !['unknown', 'refundable', 'nonrefundable'].includes(b.refund) || !['unknown', 'waived', 'due'].includes(b.cancelBalance)) return undefined;
  return b;
}
