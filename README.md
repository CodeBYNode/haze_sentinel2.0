# Haze Sentinel


Mobile-first React/TypeScript client with a small Node.js API server. The server keeps AQICN and OpenRouter secrets out of the browser bundle.


## Install and run

Use Node.js 20 or newer, then run `npm install` and `npm run dev`. `npm run build` checks types and creates the production bundle. `npm test` runs the recommendation and calendar-planning tests.

The four main destinations are Today, Schedule, Assistant, and Profile. The onboarding introduction appears on the first visit; it can be replayed from Profile. Hash links such as `/#today` and `/#schedule` open a destination directly.

## Frontend features

- Today: backend WAQI AQI, pollutant indices, actual observation time, station details and attribution, daily forecasts when current, and attributed backend news. The optional hourly demo and affected-plan examples remain clearly labeled.
- Schedule: date navigation, morning/afternoon/evening groups, activity forms and action sheets, and AI planning chat opened from its icon.
- Assistant: backend air-quality answers and returned tomorrow assessments, with visible errors and retry. Schedule replanning remains local demo behavior; proposal cards still require review and confirmation and preserve fixed commitments.
- Account: email login and registration layouts with guest access. Authentication is explicitly unconfigured and sends no credentials or email.
- Profile: personal details, notification preferences, optional health preferences, JSON export, and clearing profile information.
- Onboarding: three short introductions with original nature and haze-related SVG artwork.

## Data and integration boundaries

The active mobile UI is in `src/mobile`. Current air quality, daily forecasts, station selection, news and general assistant answers use the existing Node backend. `src/mobile/useLiveData.ts` handles independent visible-page refreshes using `/api/config`. The shared sample schedule and calendar helpers remain in `src/ui/model.ts`; demo replanning remains in `src/mobile/planning.ts`. Authentication, schedule storage and notifications have no backend integration. See [the frontend data map](docs/backend-rendering.md).

The source drawer renders backend news, publication dates, feed retrieval time, stale/error status, and station attribution. WAQI categories are rendered as returned, separately from Malaysian API/IPU. Haze outlook prefers timing reported in NewsData articles and fills missing timeframes with labelled, very-low-confidence planning assumptions. Past WAQI forecast records are not presented as an upcoming outlook.

The mobile frontend always requests the backend for supported data. Provider failures show unavailable/error states rather than sample readings. The optional hourly demo is explicitly separate from station data. The older `VITE_AIR_QUALITY_DEMO` setting no longer controls this UI.

## Storage and location

Profile → Age group opens an optional page with Under 18, 18–64, 65+, and Prefer
not to say. The choice stays in session memory, is included in profile export,
and is reset by Clear profile. No exact age or birth date is collected.
Under-18s and adults 65+ receive more cautious haze advice and outdoor activity
suggestions on Today and in the backend Assistant. Prefer not to say uses general
guidance without assuming age sensitivity. Health conditions remain separate.
The shared rules in `shared/age-guidance.mjs` change advice only, never AQI or
forecast values, and withhold a current-conditions assessment for stale/missing
readings. Age choice and selected health conditions are sent with air-quality
questions; name, email and free-text notes remain excluded. The Schedule demo
and its sample readings remain separate from this current-condition guidance.
See [AirNow's smoke readiness guidance](https://www.airnow.gov/wildfires/be-smoke-ready/)
for the greater sensitivity of children and older adults.

Activities and onboarding progress are stored in browser local storage, with fallback handling when storage is unavailable. Profile and health preferences are held only in memory. Selected health conditions and station context are sent with backend assistant questions; name, email and free-text notes are excluded. Profile clearing does not delete activities.

Location uses backend station search. When search returns no results, a city can be selected through `/api/air-quality?location=...`. Device geolocation is requested only on user action and sent to the backend coordinate feed. The returned station coordinates, rather than precise device coordinates, are retained for this session.

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

### Vercel current air quality

Deploy from the repository root using the Vite preset, `npm run build`, and the
`dist` output directory. Set `WAQI_API_TOKEN` in Vercel's environment variables
for the deployment environment, then redeploy. Do not put the token in frontend
code or prefix it with `VITE_`.

`api/air-quality.js` exposes the same handler as the local Node server. The mobile
app initially requests `/api/air-quality?location=Kuala+Lumpur`. The current
air-quality card displays the returned AQI, category, pollutants, station and
observation time. No reading or station identifier is hardcoded.

WAQI's `/feed/here/` resolves the caller's IP location. `/api/air-quality` without
a selector (or with `location=here`) uses this feed, but on Vercel this is the
server's location, so it is not used to locate a browser user. The app instead
uses explicit city names or, after permission, device latitude/longitude.

`api/locations/search.js` exposes `/api/locations/search?q=Kuala+Lumpur` for station
selection. WAQI returns each station's `uid`; the app uses that identifier as
`stationId` for subsequent `/feed/@<uid>/` requests. IDs are supplied by WAQI,
not generated by the app. City and coordinate feeds also return their resolved
station identifier, which is retained when selecting a location. Malaysia bounds
remain enforced; an IP lookup outside Malaysia reports unavailable.

`api/chat.js` and `api/assessment/tomorrow.js` expose the assistant and tomorrow
assessment on Vercel using the same handlers as the local Node server. Set
`OPENROUTER_API_KEY` and `OPENROUTER_MODEL` (for example, `openrouter/free`) in
Vercel's environment variables, then redeploy. Local development reads these
values from the ignored `.env`; the file itself is never committed or uploaded.
The server sends `POST https://openrouter.ai/api/v1/chat/completions` with
`Authorization: Bearer <OPENROUTER_API_KEY>`. No provider credential is sent to
the browser. Chat includes the current WAQI reading and the server's structured
assessment, and uses only the available news snapshot without waiting for news
requests. Missing data is disclosed instead of substituted with demo values.

`GET /api/haze-outlook?location=Kuala+Lumpur` returns `{ outlook, news }`. It calls
`https://newsdata.io/api/1/latest?q=haze` using the server-only `NEWSDATA_API_KEY`
in the documented `X-ACCESS-KEY` header. No country/language filter changes the
requested search; returned articles are grouped and filtered for local outlook
evidence. Set `NEWSDATA_API_KEY` in Vercel as well as the ignored local `.env`.
The frontend loads current WAQI air quality and news-based outlook independently,
so failure of either provider does not hide the other's data. The returned news
also populates the Sources drawer without a separate `/api/news` request.

The estimator uses simple English/Malay phrases in headlines and descriptions:
explicit future statements such as "Kuala Lumpur haze may ease tomorrow", plus
current local haze and weather signals when reported timing is absent. Only reports with a known
publication timezone from the last 48 hours mentioning the selected location
are used (KL is accepted for Kuala Lumpur). Publisher country alone is not
location evidence. Negated/ambiguous statements and expired time windows are
excluded. Syndicated headlines are grouped, not treated as independent votes.
This conservative parser may miss valid reports with unsupported phrasing.

`alleviation` and `anotherWave` independently contain `expected: true | null`,
`timeframe`, `basis`, `rationale` and linked `evidence`. Reported time windows are extracted from "today",
"tomorrow", "in N days/hours/weeks", or "within/over the next N" and resolved
from publication time, never from request time. Reported timing takes priority
over all fallback rules. When timing is missing, the fallback windows are:

| Local report signal | Assumed window after publication |
| --- | --- |
| Rain expected or rain-related easing | Relief in 12–36 hours |
| Easing conditions | Relief in 24–48 hours |
| Dry weather, hotspots or active burning | Relief in 72–120 hours; persistence/worsening risk within 48 hours |
| Other local haze or worsening | Relief in 48–96 hours; worsening adds a risk window within 24 hours |

These are deliberately rough, uncalibrated planning defaults, not measured or
validated meteorological relationships. Windows contain `basis: "reported"` or
`"heuristic"`; heuristic windows include the applied `rule`, `anchorAt`, and
`reportedText: null`. The JSON exposes the full rule table under `method`.
The card labels imposed timing "Rough haze outlook" with "Very low confidence";
the Sources drawer explains each assumption. Labels show the remaining time
from the request, while the actual bounds remain fixed to publication time.
Expired windows are discarded; refreshing the same story never extends them.
With no usable local haze signal, an event stays unknown. Evidence includes the publisher,
article link, publication time and matched sentence. Persistent/worsening haze
does not prove a separate incoming plume. This is a rough news-based estimate,
not a numerical AQI forecast or official advisory; it adds no model dependency.

Missing, stale or insufficient news produces HTTP 200 with
`outlook.status: "unavailable"` and an explanatory reason. Missing claims stay
unknown rather than implying no haze. The existing news service coalesces
concurrent requests and caches the single haze search for the configured news
refresh interval (default three hours), with a 15-minute failure retry delay.

The remaining API routes (news, config, health and spendings) still run on the
standalone Node server and need their own Vercel functions or a deployed backend
before those features will work on Vercel.

`openrouter/free` selects an available free chat model dynamically. You can replace it with a specific OpenRouter model ID, including a current `:free` variant. Free-model availability and request limits vary. A 402 on a free route can still indicate an account balance or per-key limit issue; a 429 indicates a rate limit.

## Data flow

- `src/services/airQuality.ts` calls the app API and maps provider results for the existing screens.
- `server/lib/waqi.mjs` uses documented WAQI station search, station feed, and coordinate feed endpoints; it normalizes source AQI, pollutants, weather, station, attribution, timestamps, and daily forecasts. Malaysia coordinate checks reject unrelated nearest stations. The dashboard fetches current data on entry/location changes and polls at `HAZE_REFRESH_INTERVAL_MINUTES` while visible. There is no server-side WAQI response cache: WAQI terms prohibit redistributing its data as cached or archived data. Responses use `no-store`; the UI shows observation timestamps and missing forecast timestamps as unavailable.
- `server/lib/newsdata.mjs` queries the NewsData.io latest endpoint for environment and public-impact topics in Malaysia and nearby countries. It normalizes relevance-filtered items, groups duplicate/syndicated headlines while retaining publisher identities and article URLs, and stores results only in a server-memory cache for `NEWS_REFRESH_INTERVAL_HOURS`. Refresh requests are coalesced. On failure, previous results and their retrieval timestamp remain available and are marked stale. The UI polls the local cache endpoint, not NewsData.io, so the provider refresh cadence is independent of AQI polling.
- The free NewsData.io plan currently documents 200 credits/day and up to 10 articles per request, with a 12-hour feed delay. HazeAI makes two targeted requests per cache refresh (about 16 requests/day at the 3-hour default); actual access and quotas depend on the account plan. Article publication dates remain distinct from the feed retrieval time.
- `server/lib/assessment.mjs` uses the WAQI forecast's daily PM2.5/PM10 maximum for tomorrow in `Asia/Kuala_Lumpur`. When tomorrow's forecast is missing, its result is explicitly unknown. The profile changes caution and explanation only; it never changes measurements.
- `server/lib/openrouter.mjs` sends a bounded conversation and verified current/forecast context to the configured model. It does not receive the free-text health note; it receives only whether one was disclosed. It is instructed to explain, not override, the server's structured result.
- `/api/chat` includes the latest AQI observation and a non-blocking snapshot of cached, attributed articles. News refreshes never delay AQI reads or block chat when the news service is slow. The model must treat articles as reports, retain links, avoid counting syndication as confirmation, and disclose unavailable/stale news or forecast data.
- Activities and onboarding progress stay in browser local storage; the mobile profile stays in memory for the session. No cloud sync or authentication is implemented.

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

## Spendings

Optional booking details can now be added to an activity in the original Schedule
editor. Today and Schedule include a Spendings card that opens booking exposure,
location-specific forecast checks and cash comparisons for proceeding, relocating,
rescheduling and cancelling. Only feasible options with confirmed costs receive
the minimum-cost highlight; events remain scheduled until you change them yourself.

The additive `POST /api/spendings/assess` route handles validation, forecast lookup
and calculations. Activities and booking terms continue using the existing local
browser storage. Exact-hour forecasts and forecast issue timestamps are unavailable
from the current feed and are shown as such. See [Spendings behavior and API](docs/spendings.md)
for costs, feasibility rules, persistence, limits and checks.

