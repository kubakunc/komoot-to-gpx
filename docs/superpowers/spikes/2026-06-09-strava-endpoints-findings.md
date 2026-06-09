# Strava web-endpoint spike — findings (2026-06-09)

**Verdict: GO.** The "twin" approach (WebView login → `_strava4_session` cookie →
private web endpoints) is viable. All endpoints respond to the session cookie
replayed from a non-browser HTTP client, with **no Cloudflare challenge**.

Verified live against a real logged-in account using `curl` with an
Android-Chrome User-Agent. Cookie value and the real athlete id are intentionally
omitted here.

## Make-or-break: cookie replay from non-browser HTTP — PASS

`curl` carrying only `Cookie: _strava4_session=<value>` and an Android UA gets
HTTP 200 with authenticated content on every endpoint below. No bot wall. This
is what the Android `CookieManager` + `HttpsURLConnection` path will do, so the
twin technique is green.

Required headers observed:
- `User-Agent`: a normal browser/Android UA (used the WebView UA in-app).
- For JSON list/stream endpoints: `X-Requested-With: XMLHttpRequest` — **without
  it, `training_activities` returns the full HTML page instead of JSON.**

## 1. Activity list — `GET /athlete/training_activities`

- URL: `https://www.strava.com/athlete/training_activities?per_page=20&page=1`
- Headers: cookie + `X-Requested-With: XMLHttpRequest` + `Accept: application/json`
- Status: `200 application/json`
- Shape: top-level object `{ "models": [ {...}, ... ] }`; 20 rows per page.
- Per-row fields (confirmed): `id` (number), `name`, `sport_type` (e.g. "Ride"),
  `display_type`, `activity_type_display_name`, `private` (bool), `visibility`
  ("everyone"/"only_me"/"followers_only"), `start_time` (ISO
  `2026-06-08T14:38:34+0000`), `start_date` (human), `start_date_local_raw`
  (epoch s), `distance` (string km), `distance_raw` (meters, float),
  `moving_time_raw` / `elapsed_time_raw` (s), `elevation_gain_raw` (m),
  **`has_latlng`** (bool — true ⇔ activity has GPS), `trainer`, `commute`,
  `static_map` (CDN PNG URL or null), `activity_url`.
- **No encoded polyline in the list** — preview comes from `static_map` or the
  streams endpoint (§4).
- Pagination: `per_page` + `page`. (Total count not in the body; page until a
  short/empty `models` array.)

Fixture (scrubbed, real shape): `mobile/tests/fixtures/strava-training-activities.sample.json`
— includes one GPS ride (`has_latlng: true`) and one no-GPS indoor workout
(`has_latlng: false`).

## 2. GPX export — `GET /activities/{id}/export_gpx`

- URL: `https://www.strava.com/activities/<id>/export_gpx`
- Headers: cookie (+ Android UA).
- Status: `200 application/octet-stream`; body returned **directly** (no 302).
- Body: valid GPX 1.1, `<gpx creator="StravaGPX" version="1.1" ...>` (2.7 MB for a
  ~2h ride). Use as a **passthrough** GPX string — no client-side building.
- No-GPS case: not observed (no `has_latlng:false` activity in the recent 20).
  **Guard with `has_latlng` before offering export**; also treat a non-`<gpx`
  body / non-200 as "no track" with a clear message.

## 3. Identity probe — `GET /settings/profile`

- URL: `https://www.strava.com/settings/profile`
- Status: `200 text/html`.
- Contains the current athlete id as `athleteId = <number>` (also many
  `/athletes/<id>` links). Extract id with `/athleteId\s*=\s*(\d+)/`.
- **Display name:** not exposed via the simple input regex tried. Follow-up for
  Plan 2: fetch `https://www.strava.com/athletes/<id>` and read `<title>` (the
  athlete's name), or parse the profile-form name fields. Non-blocking — the
  session can fall back to "Strava athlete" / the id until refined.

## 4. Map preview source — two options (pick in Plan 2)

- **Streams (recommended, matches Komoot's `Coordinate[]`):**
  `GET /activities/{id}/streams?stream_types[]=latlng` + `X-Requested-With` →
  `200 application/json`, shape `{ "latlng": [[lat, lng], ...] }` (7830 points
  for the test ride). Downsample like Komoot (160 pts). URL-encode the bracketed
  param: `stream_types%5B%5D=latlng`.
  Fixture: `mobile/tests/fixtures/strava-activity-detail.sample.json`.
- **`static_map` image:** the per-row CDN PNG is reachable **without a cookie**
  (`200 image/png`) — an even lighter preview (plain `<img>`), no Leaflet needed.

## Native implications for Plan 2

- Komoot yields a portable Bearer JWT; **Strava has none** — the native API
  plugin must run in **cookie-replay mode** for `strava.com`: read the cookie
  from `CookieManager.getInstance().getCookie("https://www.strava.com")` and send
  it as the `Cookie` header, plus the WebView UA and `X-Requested-With` for JSON
  endpoints. `export_gpx` uses the binary `download` mode.
- LoginActivity for Strava: load `https://www.strava.com/login`, wait for
  `_strava4_session` on `.strava.com`, then run the identity probe (§3) to get
  the athlete id; persist nothing portable — the cookie stays in `CookieManager`.
