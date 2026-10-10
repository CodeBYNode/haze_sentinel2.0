# HazeAI

Mobile-first haze guidance prototype built with React, TypeScript, and Vite.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Run `npm run dev` and open the local URL in a browser.
4. Run `npm test` for the recommendation-rule unit tests; `npm run build` checks types and creates the production bundle.

## Data and integrations

The default `DemoProvider` uses sample fixture data and marks it as demo throughout the interface. `VITE_AIR_QUALITY_DEMO=false` switches to an explicit unavailable provider so the UI exercises missing-service handling. No provider, API URL, key, scale, or Malaysian threshold is assumed. Implement `AirQualityProvider` in `src/services/airQuality.ts` against supplied provider documentation. Keep credentials in a server-side proxy for a public deployment. The policy categories in `defaultPolicy` are intentionally empty; supply and verify an authoritative policy mapping before returning an activity decision. Missing policy, stale time, or missing pollutant values yield an unable-to-determine result.

`DemoHazeAI` is a local constrained explainer, not a cloud LLM. Implement `HazeAIService` when a backend integration is supplied. It receives the deterministic application assessment; it cannot override the decision. Google sign-in has a visible unconfigured state and does not fake authentication. Guest profiles are stored in browser local storage and do not sync.

## Privacy and location

Age group and optional health answers stay in local storage for this prototype. The location request uses browser geolocation and reverse-geocodes through OpenStreetMap Nominatim; a manual Malaysian city picker is also available. Location lookup requires consent and network access. Health answers are optional and can be cleared with the local profile.

## Design research

Mobbin MCP was not available in the implementation session. No Mobbin screens, screenshots, or URLs are claimed as references. The visual direction is original and follows the supplied product requirements.
