# Spendings

Spendings adds an entry card to Today (after the original map and affected-plans
card) and Schedule (after the original planning strip). It uses the original
activity editor and shared sheets. The original mobile stylesheet, map, forecast
controls, assistant, profile, account, provider adapters and planning rules are
retained. New styles are scoped to `.spending-*` selectors.

## Storage and API

`Plan.booking` is optional. Activities, references and booking terms remain in the
existing `haze-sentinel-mobile-plans-v1` browser storage. Existing activities need
no migration and are not replaced with preview data. Invalid optional booking
data is discarded without discarding its activity. This feature adds no account,
cloud sync or database dependency.

`POST /api/spendings/assess` takes `{ events, calendar }`. Events contain booked
activity IDs, dates, start times, duration, venue location, indoor/outdoor and fixed
flags, plus structured booking costs and terms. The client omits activity titles,
booking references and free-text terms. The optional calendar contains only IDs,
dates, times and durations for unbooked activities; it is used for overlap checks.
The backend sends only the selected forecast city or station ID to WAQI. It stores
neither bookings nor provider readings, and responses use the existing `no-store`
JSON helper. Old endpoints retain their behavior.

The request accepts up to 30 bookings and 300 calendar activities, under the
existing 160 KB body limit. Money must be finite, non-negative, at most RM10m, and
have at most two decimal places. Invalid dates, times, deposits exceeding booking
totals, duplicate IDs and incomplete confirmed alternatives return HTTP 400.
Fees may be `null` (unknown); `0` means a confirmed zero fee. Provider failures
return unknown forecasts per event, allowing known cash costs to remain visible.
Lookups are coalesced only within one request, with at most three concurrent
lookups and a 35-second request deadline. Browser cancellation aborts lookups.

## Forecast and attention

Each booking selects its own forecast city or monitoring station, independently
of the Today location. When absent, the activity venue text is tried as a city;
unresolvable locations remain unknown. Times use Malaysia time (UTC+08:00).

The seven-day summary includes ongoing/upcoming activities that start within the
next 168 hours. The assessment uses the maximum valid daily PM2.5 / PM10 forecast
index over the event's calendar dates, including midnight crossings. It never
interpolates hourly conditions or substitutes current AQI, a different date, UV
data, the schedule's demo readings or preview fixtures. A provider observation
older than two hours, over five minutes in the future, or without a valid timestamp
makes the forecast unknown. Daily model issue time is unavailable in the existing
WAQI adapter and is displayed as unavailable, separately from the actual check
time and observation time.

Risk labels use forecast index <=50 (lower), <=100 (moderate), >100 (high).
These are conservative planning gates, not a statement of personal safety or
Malaysia's official API/IPU. Moderate/high outdoor events need attention. Outdoor
proceeding and rescheduling are considered feasible only at the lower daily risk
gate; the user is asked to recheck conditions and official advice. Indoor options
need explicit availability, indoor air and exposure-control confirmation. Unknown
forecast events are flagged for review and excluded from monetary totals, with
an explicit unknown count. If all upcoming forecasts are unknown, the exposure
amount is shown as unavailable, not RM0.

## Cash calculation

All comparisons are total out of pocket, including money already paid; arithmetic
uses integer cents. The entered deposit is part of the total booking value. For a
fully paid booking, enter the full payment as both total and deposit. Refund policy
is either fully refundable, non-refundable, or unknown; partial refund policies
are not supported. Entered policies must be reconfirmed if the optional booking
deadline passes; all change/cancel quotes then become unknown.

| Option | Cash cost | Feasibility |
| --- | --- | --- |
| Proceed | Booking total + additional operating costs | Lower daily outdoor risk, or confirmed indoor air/exposure controls |
| Relocate | Forfeited deposit + original cancellation fee + any original balance still due + indoor venue total + move fee + operating costs | Original settlement terms and all costs known; indoor alternative confirmed |
| Reschedule | Booking total + deposit lost if it does not transfer + change fee + operating costs | Alternative date/time and availability confirmed, lower daily outdoor risk or indoor controls, no overlap with any activity, not fixed |
| Cancel | Forfeited deposit + cancellation fee + any unpaid balance still due | Cancellation terms known |

A transferred deposit is included in the new venue total, not added twice. If the
transferred deposit exceeds the new venue price, unused credit is conservatively
assumed lost. Refunded deposits are excluded from final cash cost. Unpaid balances
are waived only when the user explicitly selects that policy. Operating costs
mean additional avoidable costs incurred if the activity takes place, so they
apply to proceed, relocate and reschedule. Expected income is shown separately
as an estimate, and as forgone income for cancellation; it is not silently netted
against cash costs or included in the cheapest-cash ranking.

Only options with known cost and established feasibility participate in the
minimum-cost highlight. For the RM120 booking with RM50 non-refundable deposit,
waived unpaid balance, zero cancellation fee, RM90 indoor venue, RM20 move fee and
RM15 change fee with transferred deposit, the costs are RM120 / RM160 / RM135 /
RM50. Forecast and venue feasibility still determine which options qualify.

The seven-day exposure is booking value requiring attention, with non-refundable
deposits (already included), operating costs and estimated income broken out
separately. It is not a loss prediction. Reviewing options never contacts a venue,
charges money, automatically cancels an event or changes its schedule. Users make
arrangements themselves and can use the existing editor to update their activity.

## Verification

`npm test` covers money, unknown fees, deposit credits, refunds, payable balances,
deadlines, indoor confirmation, alternatives, fixed events, calendar overlaps,
daily/cross-midnight coverage, stale/missing observations, invalid input, privacy
boundaries and the HTTP endpoint, alongside every existing test.
`npm run build` checks types and the production bundle.

Browser verification uses separately labeled local test activities; no fabricated
forecast or sample booking is seeded in the application. The live provider may
return only past forecast records. The UI must then show forecast unavailable,
retain the scheduled event and display only the cash quotes justified by terms.
