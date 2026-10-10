# Haze Sentinel


Mobile-first React/TypeScript client with a small Node.js API server. The server keeps AQICN and OpenRouter secrets out of the browser bundle.


## Install and run

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

Requires Node.js 20.6 or newer (Node 22+ recommended for native --env-file support).

1. Run `npm install`.
2. Add these values to the root `.env` file. The file is ignored by Git:

```env
WAQI_API_TOKEN=your_supplied_token
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=openrouter/free
NEWSDATA_API_KEY=your_newsdata_key
NEWS_REFRESH_INTERVAL_HOURS=3
HAZE_REFRESH_INTERVAL_MINUTES=10
```

3. Run `npm run dev`, then open the Vite URL. This starts both Vite and the local API server; the `/api` proxy forwards to the API. Use `npm run dev:api` only when intentionally running the API separately.
4. Run `npm test` and `npm run build` for checks.

The checked-in `.env.example` contains variable names only. Never prefix these values with `VITE_`. Values stay server-side and are not printed by the application.

`openrouter/free` selects an available free chat model dynamically. You can replace it with a specific OpenRouter model ID, including a current `:free` variant. Free-model availability and request limits vary. A 402 on a free route can still indicate an account balance or per-key limit issue; a 429 indicates a rate limit.

## Data flow

- `src/services/airQuality.ts` calls the app API and maps provider results for the existing screens.
- `server/lib/waqi.mjs` uses documented WAQI station search, station feed, and coordinate feed endpoints; it normalizes source AQI, pollutants, weather, station, attribution, timestamps, and daily forecasts. Malaysia coordinate checks reject unrelated nearest stations. The dashboard fetches current data on entry/location changes and polls at `HAZE_REFRESH_INTERVAL_MINUTES` while visible. There is no server-side WAQI response cache: WAQI terms prohibit redistributing its data as cached or archived data. Responses use `no-store`; the UI shows observation timestamps and missing forecast timestamps as unavailable.
- `server/lib/newsdata.mjs` queries the NewsData.io latest endpoint for environment and public-impact topics in Malaysia and nearby countries. It normalizes relevance-filtered items, groups duplicate/syndicated headlines while retaining publisher identities and article URLs, and stores results only in a server-memory cache for `NEWS_REFRESH_INTERVAL_HOURS`. Refresh requests are coalesced. On failure, previous results and their retrieval timestamp remain available and are marked stale. The UI polls the local cache endpoint, not NewsData.io, so the provider refresh cadence is independent of AQI polling.
- The free NewsData.io plan currently documents 200 credits/day and up to 10 articles per request, with a 12-hour feed delay. HazeAI makes two targeted requests per cache refresh (about 16 requests/day at the 3-hour default); actual access and quotas depend on the account plan. Article publication dates remain distinct from the feed retrieval time.
- `server/lib/assessment.mjs` uses the WAQI forecast's daily PM2.5/PM10 maximum for tomorrow in `Asia/Kuala_Lumpur`. When tomorrow's forecast is missing, its result is explicitly unknown. The profile changes caution and explanation only; it never changes measurements.
- `server/lib/openrouter.mjs` sends a bounded conversation and verified current/forecast context to the configured model. It does not receive the free-text health note; it receives only whether one was disclosed. It is instructed to explain, not override, the server's structured result.
- `/api/chat` includes the latest AQI observation and a non-blocking snapshot of cached, attributed articles. News refreshes never delay AQI reads or block chat when the news service is slow. The model must treat articles as reports, retain links, avoid counting syndication as confirmation, and disclose unavailable/stale news or forecast data.
- Guest preferences stay in browser local storage. No cloud sync or authentication is implemented.

WAQI's index and category are identified as WAQI AQI. They are not Malaysia's official API/IPU and are not converted. The daily AQI maximum is a model forecast, not an observation or official Malaysian advisory; it does not imply hour-by-hour conditions. The card links to WAQI and displays source attributions. AQICN's documented public terms prohibit selling or paid-service inclusion and disallow cached/archived redistribution; public for-profit use needs explicit agreement. This MVP does not store historical readings or train a model.

## Verification and integration limits

Unit tests use mocked provider and model responses. NewsData.io articles are held in process memory only; restarting the API clears the cache and causes the next feed request to refresh. No historical data is retained. No separate weather forecast is added: tomorrow's haze assessment uses WAQI's own AQI forecast only when that station returns a relevant forecast.

## References

- [WAQI JSON API and usage terms](https://aqicn.org/api/)
- [OpenRouter chat completions reference](https://openrouter.ai/docs/api-reference/overview)
- [NewsData.io API documentation](https://newsdata.io/documentation)
- [NewsData.io pricing and current plan limits](https://newsdata.io/pricing)
- [WAQI API terms of service](https://aqicn.org/api/tos/)
- [Malaysia MOH haze health advice](https://www.moh.gov.my/en/core/health-information/jerebu/artikel-dan-panduan-pengguna-berkaitan-jerebu/panduan-kesihatan-untuk-anda)
- [Department of Environment explanation of Malaysia API](https://www.doe.gov.my/2021/10/04/english-air-pollutant-index-api/)

