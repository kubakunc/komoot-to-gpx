# Strava Routes mini-spike — findings (2026-06-09)

**Verdict: GO** (endpoint captured from DevTools; verified end-to-end with curl).

## Working endpoint (verified)

- **List:** `POST https://www.strava.com/api/next/data/routes/my-routes`
  - Headers: `Content-Type: application/json`, `X-Requested-With: XMLHttpRequest`,
    `X-CSRF-Token: <token>`, `Origin`/`Referer: https://www.strava.com/...`, the
    session cookie (the full CookieManager set — `_strava4_session`, `_strava_idcf`,
    CloudFront-* etc.).
  - Body: `{"pageSize":N,"after":"<offset>","searchArgs":{"query":"","onlyStarred":false,"createdBy":"Any","routeTypes":[...],"elevGainMin":0,"elevGainMax":null,"distanceMin":0,"distanceMax":null},"resolutions":[{"height":192,"width":280,"isRetina":true}]}`
  - `after` is a numeric offset string ("0", then "16", …); `pageInfo.hasNextPage`
    signals more.
  - Response: `{ me: { searchRoutes: { nodes: [...], pageInfo: {...} } } }`.
    Node fields: `id` (string), `title`, `length` (m), `elevationGain` (m),
    `creationTime` (ISO), `routeType` ("Ride"/"GravelRide"/…), `isPrivate` (bool),
    `themedMapImages[0].lightUrl` (static map PNG — **the preview; no polyline**).
- **CSRF token:** scraped from a rails page — `GET /dashboard` →
  `<meta name="csrf-token" content="...">` (86 chars). The Next.js routes page
  itself has **no** csrf meta.
- **GPX export:** `GET https://www.strava.com/routes/{id}/export_gpx` → 200
  `application/octet-stream`, valid `<gpx creator="StravaGPX">`. The route GPX is
  the source for the detail map + elevation (parse trkpts).

Fixture (scrubbed, real shape): `mobile/tests/fixtures/strava-routes.sample.json`.

## In-app implications

- Native `StravaApiPlugin` needs a **POST** method that scrapes the CSRF token
  (GET /dashboard, cache it, refresh on 403) and sends the cookie + csrf.
- Route preview = the `lightUrl` static image (the list card shows an `<img>`,
  not the Leaflet MiniMap). The detail screen parses the route's `export_gpx`
  for coordinates (map + elevation).

---

## (Historical) blind probing — why it failed

Unlike recorded activities (`/athlete/training_activities` returns clean JSON for
an XHR — see the first spike), the **Routes page is now a Next.js SPA** and its
routes-list data is fetched client-side by a request I could not discover by
guessing.

## What was tried (all with a valid `_strava4_session` cookie + Android UA)

| Endpoint | Result |
|---|---|
| `GET /athletes/{id}/routes` (XHR) | 404 |
| `GET /athletes/{id}/routes` (HTML) | 404 |
| `GET /athlete/routes` (XHR) | 200 but **Next.js HTML shell** (550 KB), no route rows |
| `GET /frontend/athletes/{id}/routes` | 404 |
| `GET /api/v3/athlete(s)/routes` | 401 (needs an OAuth bearer token, not the cookie) |
| `GET /_next/data/{buildId}/en-US/athlete/routes.json` | 404 |
| `GET /orca/api/v0/athletes/{id}/routes` | 404 |

`__NEXT_DATA__` on `/athlete/routes` carries only `namespacesRequired`, sentry
trace ids and `url` — **no routes payload** (it's hydrated client-side).

## What's needed to finish (Task 7 gate)

Open `https://www.strava.com/athlete/routes` in a logged-in desktop browser →
DevTools → **Network** → filter XHR/Fetch → reload. Capture the request that
returns the routes JSON:
- exact URL + query params + method,
- request headers that matter (Authorization? a CSRF/`x-csrf-token`? a cookie
  beyond `_strava4_session`?),
- the JSON response shape (id, name, distance, elevation_gain, created date, and
  the preview source — encoded `summary_polyline` vs a latlng array).

Also capture one route's GPX: `https://www.strava.com/routes/{id}/export_gpx`
(this likely still works with the cookie — unverified here because we have no
route id without the list).

## Decision pending

Until the routes endpoint is captured:
- Activities path (Tasks 1–5) ships and works.
- The Strava **Routes** filter chip is non-functional (it currently falls back to
  the activities endpoint). Either hide it until the endpoint is known, or keep
  it as a known-WIP — user's call.
