# Haze Sentinel

A mobile-first, light-only haze and activity-planning frontend built with React, TypeScript, and Vite.

## Run locally

Use Node.js 20 or newer, then run `npm install` and `npm run dev`. `npm run build` checks types and creates the production bundle. `npm test` runs the recommendation and calendar-planning tests.

The four main destinations are Today, Schedule, Assistant, and Profile. The onboarding introduction appears on the first visit; it can be replayed from Profile. Hash links such as `/#today` and `/#schedule` open a destination directly.

## Frontend features

- Today: current Malaysian API, separate arrival/relief outlook, source sheet, nearby pollution map, affected-plan bar, and selectable hourly forecast.
- Schedule: date navigation, morning/afternoon/evening groups, activity forms and action sheets, and AI planning chat opened from its icon.
- Assistant: activity prompt icons, local planning responses, and proposal cards. Calendar changes require review and confirmation, respect fixed commitments, and avoid overlapping existing activities.
- Account: email login and registration layouts with guest access. Authentication is explicitly unconfigured and sends no credentials or email.
- Profile: personal details, notification preferences, optional health preferences, JSON export, and clearing profile information.
- Onboarding: three short introductions with original nature and haze-related SVG artwork.

## Data and integration boundaries

The active mobile UI is in `src/mobile`. Readings, geography, forecasts, and activity assessments are labeled demo data. The shared sample data and calendar helpers live in `src/ui/model.ts`; constrained local assistant responses live in `src/mobile/planning.ts`. No cloud LLM, news ingestion, authentication service, or live air-quality feed is connected.

The source drawer links real background reporting with original publication dates. It explicitly states that these articles were not used to calculate the illustrative arrival/relief times. A production prediction needs current observations, a forecast service, and source records from that service. Display categories use the [Malaysian DOE API bands](https://www.doe.gov.my/en/api-2/); they do not constitute a personal health assessment.

`VITE_AIR_QUALITY_DEMO=false` shows unavailable current conditions and prediction timing on Today. The local schedule and assistant remain labeled demo features. The older provider and recommendation interfaces in `src/services` and `src/core` remain available for a future backend integration.

## Storage and location

Activities and onboarding progress are stored in browser local storage, with fallback handling when storage is unavailable. Profile and health preferences are held only in memory for the session and are not passed to the assistant. Profile clearing does not delete activities.

Location can be chosen manually. Device geolocation is requested only after the user chooses the location control and selects the nearest supported demo area; coordinates are not sent to a reverse-geocoding service. Reading values remain illustrative.

## Design and verification

The visual system uses warm ivory, sand, muted sage, olive, terracotta, and espresso, with Lora headings and DM Sans interface text. Fonts fall back to Georgia and the system sans-serif when Google Fonts is unavailable. The app remains light when the device requests dark mode.

See [the design brief](docs/mobile-design.md) for the supplied Mobbin references and implementation decisions. Browser screenshots and the flow-verification report are in `outputs/mobile-preview`. The optional `scripts/check-mobile.mjs` browser check expects Playwright and Chrome to be available; set `MOBILE_PREVIEW_URL` to test a different local preview URL.
