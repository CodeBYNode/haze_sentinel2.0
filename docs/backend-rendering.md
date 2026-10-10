# Frontend data sources

The active entry point is `src/main.tsx`, which renders `src/mobile/App.tsx`.
No files under `server/` were changed for this integration.

| Frontend area | Existing backend | Rendering |
| --- | --- | --- |
| Current conditions | `GET /api/air-quality` | Actual WAQI AQI, category, pollutant indices, dominant pollutant, observation timestamp and source. Missing values remain unavailable. |
| Location selection | `GET /api/locations/search`; `GET /api/air-quality` | Station options from search; direct city lookup when search is empty; coordinate lookup after device permission. |
| Station details | Air-quality response | Actual station name, coordinates, URL and attribution. Nearby mapping remains an optional labeled demo because there is no nearby-station map feed. |
| Daily outlook | Air-quality response `forecast` | Supplied daily minimum, average and maximum values. Past dates do not count as upcoming forecasts. No hourly interpolation or arrival/relief calculation. |
| News and source sheet | `GET /api/news` | Publisher, article links, short descriptions, publication timestamps, syndication links, feed retrieval time and stale/error state. |
| Air-quality assistant | `POST /api/chat` | Backend reply, current observation, data errors and structured tomorrow assessment. Retry preserves the original location/profile context. |
| Poll cadence | `GET /api/config` | Air refresh uses configured minutes; news polls the backend cache every 5–15 minutes. Both refresh on visibility resume; obsolete requests are cancelled. |
| Schedule, affected plans and replanning | No schedule or hourly API | Existing browser-local demo plans, sample indices, proposal review and fixed-commitment rules remain. |
| Hourly forecast, example haze timing and nearby map | No hourly or nearby-map API | Optional explicitly labeled demos, separate from current station data. |
| Accounts, notification preferences and profile storage | No corresponding API | Existing unconfigured/guest demo behavior remains. Selected health choices are mapped only for assistant requests; identity and notes are excluded. |

Provider failures do not trigger a fallback to invented live data. WAQI pollutant
fields are individual indices; they are not displayed as mass concentration.
The backend's tomorrow assessment is displayed as a daily outlook, never as a
current activity verdict. The backend remains responsible for assessment rules.

## Checks

Run `npm test` and `npm run build`. Frontend tests cover API mapping, zero/missing
values, numeric station identifiers, backend failures, privacy boundaries,
WAQI category styling, current-versus-demo rendering, and missing forecasts.

Live verification on 11 October 2026 found a working Kuala Lumpur observation
and a news feed. Station search returned an empty list, so the frontend supports
direct city lookup through the existing reading endpoint. Forecast records were
dated before the current day, so the UI correctly reports no upcoming forecast.
These are backend response limitations; backend code was not altered.
