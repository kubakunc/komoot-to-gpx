# Strava support via a provider abstraction — design

**Date:** 2026-06-09
**Status:** Approved (brainstorming) — ready for implementation plan
**App:** Export GPX for Komoot (Android, Capacitor 6 + SvelteKit/Svelte 5), brand VeloLogic Labs, package `com.velologiclabs.gpxexporter`

## 1. Goal

Add Strava as a second source alongside Komoot, so users can export their
Strava activities as GPX on their phone — a real gap, because the Strava
mobile app does not allow GPX export (only the desktop website does).

Two goals drive this: (1) reach new users searching for a Strava GPX
exporter, and (2) serve existing Komoot users who also use Strava.

## 2. Key decisions (locked during brainstorming)

- **One app, two providers** — not two separate apps. The provider
  abstraction is the shared core; whether we ever split into two listings
  becomes a cheap, data-driven decision later (see §9).
- **"Twin" integration technique, NOT the official Strava API.** Strava's
  official OAuth2 API has a restrictive policy (athlete-count approval gate,
  usage restrictions, API agreement obligations). We instead mirror the
  Komoot approach: WebView login → session cookie → private web endpoints.
- **App title stays "Export GPX for Komoot".** "Strava" goes into the
  per-locale store description and keywords, never the canonical app title.
  Rationale: putting "Strava" in the app *name* violates Strava brand
  guidelines and is the highest-risk trademark trigger; a competitor app with
  10K+ installs keeps both brands out of the canonical title and only uses
  them in localized listing text. (Alternative considered: title
  "Export GPX for Komoot, Strava" — higher discoverability, higher takedown
  risk. Rejected in favor of the lower-risk pattern.)
- **Plugin generalization, not duplication.** The existing Komoot native
  plugins become provider-parameterized (config-driven) rather than spawning
  a parallel `StravaAuth`/`StravaApi` set.
- **Spike-first.** The first implementation step is a technical spike that
  verifies Strava's private endpoints behave under a session cookie, before
  building the full provider.

## 3. Architecture — provider abstraction (TS client layer)

All platform-specific code hides behind one `Provider` interface. The rest of
the app (list, preview, GPX save, ads, analytics) is provider-agnostic.

```ts
export type ProviderId = 'komoot' | 'strava';

export interface ProviderSession {
  provider: ProviderId;
  userId: string;
  displayName: string;        // email (Komoot) / athlete name (Strava)
  token: string;              // long-lived token (Komoot) / session marker (Strava)
}

export interface ActivitySummary {
  id: string; name: string; sport: string;
  distance: number; date: string;
  kind: 'recorded' | 'planned';   // Komoot has planned; Strava recorded-only
}

export interface ActivityDetail {
  meta: { id: string; name: string; sport: string; date: string };
  preview: Coordinate[];           // for MiniMap
}

export interface Provider {
  id: ProviderId;
  label: string;                                   // "Komoot" / "Strava"
  capabilities: { planned: boolean };              // gates Completed/Planned filter
  login(): Promise<ProviderSession>;               // opens WebView, returns session
  listActivities(s: ProviderSession, opts: { page: number; filter?: TourFilter }):
    Promise<{ items: ActivitySummary[]; page: number; totalPages: number }>;
  getActivity(s: ProviderSession, id: string): Promise<ActivityDetail>;
  getGpx(s: ProviderSession, id: string): Promise<string>;   // GPX 1.1 XML
}
```

**Implementations:**
- `KomootProvider` — wraps existing `nativeLogin()`, `listTours()`,
  `getCoordinates()` + `buildGpx()`. No logic change, just an adapter.
  `getGpx()` builds the GPX client-side from coordinates (current behavior).
- `StravaProvider` — new. `login()` via WebView on `strava.com`,
  `listActivities()` via Strava's internal web endpoint, `getActivity()`
  decodes `summary_polyline` for the preview, and `getGpx()` **downloads the
  file directly** from `/activities/{id}/export_gpx` (no client-side build).

**Session model:** `session.ts` becomes provider-aware. It can hold sessions
for **both** platforms simultaneously, keyed by `ProviderId`. A build with a
single provider simply never stores the other.

## 4. Native plugins (Android) — generalization

Today: `KomootAuthPlugin` (WebView → cookie → token), `KomootApiPlugin`
(GET proxy with token), `GpxSaverPlugin` (file save). Generalize the first two;
leave the saver untouched.

- **`WebSessionAuthPlugin`** (generalized `KomootAuthPlugin`) — takes a
  provider config `{ loginUrl, cookieDomain, identityProbe }`. Opens a WebView
  at `loginUrl`, waits for a cookie on `cookieDomain`, runs `identityProbe`
  (Komoot: `GET /v006/account/` → userId+token; Strava: scrape athleteId+name
  from dashboard/settings), returns `{ userId, displayName, token-or-cookieRef }`.
  The large cookie header never crosses the JS bridge. `LoginActivity.kt` gets
  a `provider` parameter so it loads the right host and theme.
- **`WebSessionApiPlugin`** (generalized `KomootApiPlugin`) —
  `request({ baseUrl, path, sessionRef }) → { status, body }` for JSON, **plus
  a binary mode** `download({ baseUrl, path, sessionRef }) → file contents`
  (the GPX string from `…/export_gpx`). Komoot never uses the binary mode;
  Strava uses it in `getGpx()`.
- **`GpxSaverPlugin`** — unchanged.

Cost: a one-time refactor of the two Komoot plugins to a parameterized form,
preserving current Komoot behavior 1:1. Benefit: if we ever split into two
apps, each build injects one provider's config — still a clean boundary, with
no duplicated native code in the meantime.

## 5. UI/UX

Current flow: login → tour list → tour detail; header has a Komoot link +
email/sign-out.

1. **Login — platform choice.** Two buttons: **"Sign in with Komoot"** and
   **"Sign in with Strava"**. The user may connect one or both. After
   connecting one, the other stays available (e.g. a "+ Connect Strava" action
   on the list). Sessions stored independently.
2. **Source switcher — segmented control above the list.** When both are
   connected, show `[ Komoot | Strava ]`. When only one is connected, no
   switcher (no empty tab). Switching reloads the list from the active provider.
3. **List & filters.** Same list component, fed by the active provider. Show
   the Completed/Planned filter only when `capabilities.planned === true`
   (Komoot yes, Strava no).
4. **Detail & export.** Unchanged flow: MiniMap from `preview`, export button
   calls `provider.getGpx()`.
5. **"Powered by Strava" badge** shown when the active source is Strava (their
   brand guideline allows/encourages this). No badge for Komoot.
6. **Analytics `provider` dimension.** Every event (`login_success`,
   `export_success`, `export_fail`, `filter_change`, …) gets
   `provider: 'komoot' | 'strava'`. This is the signal that later answers
   "is it worth splitting into two apps?" (§9).

## 6. Strava data flow + open technical risks

The twin approach relies on **private Strava web endpoints**, so the spike
(§8, task 0) must verify these on a live account before the full build.

- **Login:** WebView at `https://www.strava.com/login`; user signs in with
  **email + password** (Google/Apple/Facebook buttons may not work inside a
  WebView — reuse the existing Komoot-style note). Strava sets the
  `_strava4_session` cookie for `.strava.com`.
- **Identity probe:** extract `athleteId` + name. `api/v3/athlete` needs an
  OAuth bearer token (not the cookie), so scrape from the dashboard/settings
  page instead. ⚠️ verify.
- **List activities:** candidate endpoint
  `https://www.strava.com/athlete/training_activities` (used by the training
  log) — paginated JSON. ⚠️ verify exact params/shape.
- **GPX download:** `https://www.strava.com/activities/{id}/export_gpx` with
  the session cookie → GPX file. Activities without GPS (manual/trainer) →
  empty/error; handle with a clear message.
- **Preview:** decode `summary_polyline` (Google encoded polyline) → lat/lng.
  Small client-side function, no extra heavy call. ⚠️ confirm the list endpoint
  returns the polyline; otherwise fetch detail.

**Open risks (honest):**
1. Exact list endpoint + JSON shape.
2. Reliable `athleteId` + name extraction.
3. **Cloudflare / bot protection** — native requests must reuse the WebView's
   cookie jar (as the Komoot plugin already does), or they may be blocked.
4. Pagination / rate limiting.
5. Activities without GPS → empty `export_gpx`.

## 7. Store / legal / Data Safety

- **Listing:** title unchanged. Strava goes into per-locale description +
  keywords: e.g. "Also works with Strava — export your activities as GPX,
  right from your phone." Add disclaimer: "Not affiliated with, endorsed by,
  or sponsored by komoot GmbH or Strava Inc." Do **not** use Strava's orange or
  logo in the icon/graphics.
- **Privacy policy** (`docs/privacy-policy/index.html`), same no-backend model:
  §3 Strava session cookie also stored encrypted on-device; §4 add
  `www.strava.com` to endpoints; §6 add the Strava trademark next to Komoot.
- **Data Safety (Play):** **no change to data types.** Strava adds no new data
  categories — the session lives locally like Komoot's; the Firebase
  declaration is unchanged. No new form overhead.
- **Risk register:** ToS risk for both platforms (private web endpoints) —
  accepted, monitored via Crashlytics + the `provider` analytics dimension;
  trademark — handled via naming + disclaimer; endpoint instability (no API
  contract) — monitored via Crashlytics.

## 8. Testing

- **Vitest (node env)** — pure functions and mappers:
  - `summary_polyline` decoder → lat/lng list (table tests),
  - Strava response mapper → `ActivitySummary` (sample JSON),
  - provider registry + `capabilities.planned` gating,
  - `getGpx`: Strava = file passthrough, Komoot = build from coordinates,
  - `session.ts` multi-provider: get/set/clear per platform.
- **Native (WebView/Cloudflare):** manual verification in the spike; in
  production, Crashlytics + the `provider` event dimension.
- Mock the plugin bridge in unit tests (as existing tests do).
- **Implementation ordering:** **Task 0 is the spike** — verify
  login→cookie, list, `export_gpx`, polyline on a real Strava account. If any
  fails under the cookie, the twin approach is reconsidered before further work.

## 9. Deferred decisions (data-driven later)

- **One listing vs two.** Built so a split is cheap (provider config per
  build). Decide later using the `provider` analytics dimension — if Strava
  engagement is strong, consider a dedicated listing then.
- **Final app title.** Locked to "Export GPX for Komoot" for now; the title is
  a pure listing decision, revisitable at listing time.

## 10. Follow-up (explicitly out of scope for this iteration — YAGNI)

- **Share-intent from Strava** (share an activity from the Strava app into this
  app). Komoot share stays as-is. **We will return to sharing in a later
  iteration** once the Strava activity-URL format is confirmed easy to parse.
  Do not block the first version on it.

## 11. Versioning

Per project rule: user-facing CHANGELOG entry in the **same commit** as each
mobile/ change ("Added Strava: sign in and export your activities as GPX").
Bump versionCode / build the AAB **only on an explicit "release" instruction.**
