# Komoot token refresh + cookie hygiene — design

**Date:** 2026-06-11
**Status:** approved (brainstorm with user)

## Problem

The Komoot session dies ~30 minutes after sign-in. `LoginActivity` extracts only
the access JWT from the `koa_at` cookie (`<userId>|<JWT>|<expiry>`, JWT TTL
observed on-device: `exp - iat = 1800 s`) and discards the `koa_re` refresh
token. When the JWT expires, every API call returns 401, `onAuthFail` clears
the session, and the user lands on the login screen. This is the dominant
"why am I signed out again" complaint path (it also surfaced as "share opens
the login screen").

A second, related defect found during the spike: both login activities call
`CookieManager.removeAllCookies(null)` in `onCreate`, which wipes **the other
provider's** cookies too — connecting/re-logging Komoot kills the Strava
cookie session and vice versa (observed: Komoot cookies gone from the device
cookie store after a Strava re-login).

## Goal

The Komoot user stays signed in as long as the Komoot web/app would keep them
signed in (i.e. while `koa_re` is valid — weeks). Sign-out happens only when a
refresh ultimately fails. Twin technique throughout; no official API.

## Non-goals

- No change to the Strava auth model (cookie replay already survives long
  sessions there).
- No secure-storage migration, no allowBackup change (tracked separately from
  the production code review).
- No new UI.

## Design

### 1. Native refresh in `KomootApiPlugin`

Current: `get(path, token)` → on 401 the JS layer signs the user out.

New flow inside the plugin:

```
get(path, token)
  → api.komoot.de returns 401
  → refreshSession()                       [single-flight: synchronized;
                                            concurrent 401s wait for one refresh]
      GET https://www.komoot.com/          [Cookie: jar from CookieManager,
                                            WebView-style User-Agent]
      → collect every Set-Cookie response header
      → write each into CookieManager (setCookie + flush)
      → read koa_at from CookieManager → URL-decode → split "|" → new JWT
  → success: retry the original request with the new Bearer
             → resolve { status, body, newToken }
  → failure (no fresh koa_at, or retry still 401):
             → resolve { status: 401 }     [exactly today's behaviour]
```

Notes:
- `HttpsURLConnection` does not write response cookies into the WebView
  CookieManager by itself — the plugin must copy `Set-Cookie` headers over
  explicitly.
- Refresh is attempted at most once per `get()` call.
- The plugin keeps no long-lived token state; the JS side owns persistence.

### 2. JS token propagation

- `komoot.ts` — `apiGet` takes the `KomootAuth` object instead of a bare token
  string. When a response carries `newToken`:
  1. mutate `auth.token = newToken` — the second sequential call inside
     `getActivity` (getTour → getCoordinates) reuses the fresh token without a
     second refresh round-trip;
  2. call a module-level `onTokenRefreshed(newToken)` hook.
- `providers/komoot.ts` — registers the hook: persist
  `setProviderSession({ ...session, token: newToken })`. Pages already re-read
  the session from Preferences before every action, so persisting is enough.
- Error semantics unchanged: a final 401 still surfaces as `KomootError(401)`
  → `isProviderAuthError` → existing sign-out path.

### 3. Cookie hygiene (required for refresh to survive; includes review #7)

- New native helper `clearCookiesFor(url, domain)`: Android's CookieManager
  has no per-domain clear, so iterate the names in `getCookie(url)` and
  overwrite each with `name=; Domain=<domain>; Path=/; Expires=Thu, 01 Jan
  1970 00:00:00 GMT`. The `Domain=` attribute is required — a host-scoped
  overwrite does not remove a `.komoot.com`/`.strava.com` domain cookie. Write
  both variants (with and without `Domain=`) to cover host- and domain-scoped
  cookies.
- `LoginActivity.onCreate` clears only `komoot.com` cookies;
  `StravaLoginActivity.onCreate` clears only `strava.com` cookies. Logging in
  to one provider no longer destroys the other's cookie session.
- New `logout()` plugin method on `KomootAuthPlugin` and `StravaAuthPlugin`
  that clears that provider's domain cookies. The `Provider` interface gains
  optional `logout?(): Promise<void>`; `SourceMenu.signOut` calls it for every
  connected provider (fixes "Sign out leaves valid web sessions on device").

### 4. Spike / validation gate (Task 0 of the plan)

Hypothesis: a plain page GET to `www.komoot.com` with a valid `koa_re` and an
expired `koa_at` makes Komoot's SSR rotate `koa_at` via `Set-Cookie`.

Procedure: sign in to Komoot on the emulator → wait ≥35 min for the JWT to
expire → open the list with the refresh build installed → read logcat
(`KomootApi: refresh ...`).

Fallback if the hypothesis fails: swap `refreshSession()`'s implementation for
a hidden-WebView refresh (load `www.komoot.com` in an offscreen WebView; the
page refreshes cookies through the normal browser path; then read `koa_at`
from CookieManager). The plugin interface, JS contract, and cookie hygiene are
unchanged — only the refresh internals differ.

## Error handling

- Refresh network error / no new `koa_at` / retry 401 → `{ status: 401 }` to
  JS → existing `onAuthFail` (clear session, go to login). No new error states.
- `Set-Cookie` copy failures are logged and treated as refresh failure.
- No PII in new logs: log token lengths/expiries, never values, names only.

## Testing

- **Vitest:** `apiGet` mutates the shared auth object and fires the hook on
  `newToken`; provider hook persists the session; final 401 still maps to
  `KomootError(401)`.
- **Manual on device:** (a) session works past the 30-minute mark without
  re-login; (b) Strava re-login does not break Komoot and vice versa;
  (c) Sign out removes both domains' cookies (verify cookie names in the
  cookie store).
