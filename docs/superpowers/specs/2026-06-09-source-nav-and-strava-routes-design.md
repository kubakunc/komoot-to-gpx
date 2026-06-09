# Source navigation + Strava Routes + per-provider filters — design

**Date:** 2026-06-09
**Status:** Approved (brainstorming) — ready for implementation plan
**App:** Export GPX for Komoot, Strava (Android, Capacitor 6 + SvelteKit/Svelte 5)
**Builds on:** `docs/superpowers/specs/2026-06-09-strava-provider-design.md` (the provider abstraction is already shipped and live on-device).

## Problem

On-device testing of the shipped Strava support surfaced three gaps:

1. **No way to switch sources or connect the second provider.** The inline
   source switcher only appears when *both* providers are already connected, and
   there is no path to connect the second provider once you're signed in to one.
   The header's "Komoot" link is just an external link to komoot.com — confusing
   in a multi-provider app.
2. **Strava planned Routes are missing.** We show only recorded activities;
   Strava keeps planned **Routes** in a separate place, and those are often the
   most valuable thing to export as GPX (you plan a route, load it onto a
   Garmin/Wahoo to navigate).
3. **No elevation gain for Strava.** The detail screen shows "—" because the
   `latlng` stream carries no altitude.

## 1. Source menu (header dropdown)

Replace the header's external "Komoot" link with a **source menu**. The header's
right side shows the active source as a button `{label} ▾` (e.g. "Strava ▾").
Tapping opens a dropdown:

```
   ┌────────────────────┐
   │ ● Strava (Ada)     │  ← active (tap = no-op)
   │ ○ Connect Komoot   │  ← tap = Komoot login (native WebView), keeps Strava
   │────────────────────│
   │   Sign out         │
   └────────────────────┘
```

Behaviour:
- **Switch:** when both providers are connected, each shows as a row (● = active);
  tapping an inactive one calls `setActiveProvider(id)` and reloads the list.
- **Connect the other provider:** "Connect {label}" calls `getProvider(id).login()`
  (opens the native WebView from anywhere), then on success stores the session,
  sets it active, and reloads. This is the capability that's missing today.
- **Sign out:** a single "Sign out" clears **all** connected providers and
  returns to `/login` (matches current behaviour). Per-source disconnect is out
  of scope (YAGNI) for this iteration.
- The left brand link (to `/`) stays.

**Component:** new `SourceMenu.svelte` rendered in `+layout.svelte`'s header. It
reads `getConnectedProviders()` + `getActiveProvider()` and calls
`login` / `setActiveProvider` / `clearProviderSession`. The **inline segmented
switcher on the list page is removed** — the menu replaces it as the single
place for source control. After connect/switch the list must reload; the layout
exposes the active source via the existing `active-provider.ts` store and the
list reacts on navigation/mount.

## 2. Per-provider filters

Replace the hard-coded `capabilities: { planned: boolean }` and the hard-coded
All/Completed/Planned chips with a **provider-declared filter set**:

```ts
capabilities: { filters: { id: string; label: string }[] }
```

- **Komoot:** `[{id:'all',label:'All'}, {id:'recorded',label:'Completed'}, {id:'planned',label:'Planned'}]`
- **Strava:** `[{id:'activities',label:'Activities'}, {id:'routes',label:'Routes'}]`

`provider.listActivities(session, { page, filter })` receives the **filter id**
(a provider-defined string). `KomootProvider` maps `all/recorded/planned` to its
existing type parameter (no logic change). `StravaProvider` maps `activities` →
the training_activities endpoint and `routes` → the routes endpoint (§3).

The list always renders the filter chips (both providers have ≥2 filters); the
default is the first filter in the set, and switching source resets the filter to
the new provider's first entry. `capabilities.planned` is removed; the
`ActivityFilter` type becomes a plain `string`. Existing provider/registry tests
are updated to the new `capabilities.filters` shape.

## 3. Strava Routes

Strava keeps planned Routes separate from activities, with a different list
endpoint and a different GPX export URL. We surface them under the `routes`
filter of the Strava provider.

**Mini-spike (GATE, same method as the first Strava spike).** Verify on a live
account before building:
- Routes list endpoint (candidate: `GET /athletes/{athleteId}/routes` as an XHR
  with `X-Requested-With`) — URL, JSON shape, per-row fields (id, name,
  distance, elevation_gain, and the preview source).
- Export: `GET /routes/{id}/export_gpx` → GPX file.
- **Preview source:** whether the routes list returns `latlng`/streams or an
  **encoded polyline**. If it's an encoded polyline, add a small Google-polyline
  decoder (`src/lib/client/polyline.ts`) — not needed for activities, which use
  the `latlng` stream.

Capture scrubbed fixtures: `mobile/tests/fixtures/strava-routes.sample.json`
(and a route-detail/preview sample if the shape differs). Record findings +
GO/NO-GO in `docs/superpowers/spikes/2026-06-09-strava-routes-findings.md`.

**Data model:**
- Routes map to `ActivitySummary` with `kind: 'planned'`; activities keep
  `kind: 'recorded'`. Card + badge render unchanged.
- **Id namespace (key decision):** activities and routes have separate id spaces
  and separate export URLs, while the app routes everything through `/tour/[id]`
  and `getActivity(id)`/`getGpx(id)`. The Strava provider therefore **encodes the
  item type in the id**: `activity-<id>` and `route-<id>` (URL-safe). Its
  `getActivity`/`getGpx` parse the prefix and pick the correct endpoint
  (`/activities/{id}/export_gpx` vs `/routes/{id}/export_gpx`). Komoot keeps
  plain numeric ids. A small pure helper `parseStravaId(s)` → `{ type, rawId }`
  is unit-tested.
- Route date = the route's created date if present, else `''` (the card's
  `fmtDate` already renders `—` for empty/invalid).

**Export:** routes export is a passthrough of `/routes/{id}/export_gpx`, mirroring
the activity GPX path.

## 4. Elevation gain for Strava activities

The `latlng` stream has no altitude. Request the altitude stream alongside it in
one call: `/activities/{id}/streams?stream_types[]=latlng&stream_types[]=altitude`
→ `{ latlng: [[lat,lng], ...], altitude: [m, ...] }`. A generalized mapper
`streamsToCoordinates(body)` zips `latlng` with `altitude` into
`Coordinate { lat, lng, alt }`. The detail screen's existing `elevationGain()`
already guards missing altitude (`—`) and now computes a real value. (The
`altitude` stream key is confirmed during the §3 mini-spike — it is Strava's
standard stream name.)

## 5. Testing

- **Vitest (pure functions):**
  - `streamsToCoordinates` — merges latlng + altitude; omits `alt` when the
    altitude stream is absent.
  - Strava routes mapper → `ActivitySummary` (`kind:'planned'`, `route-` id) against
    `strava-routes.sample.json`.
  - `parseStravaId('activity-123' | 'route-9')` → `{ type, rawId }`.
  - Per-provider `capabilities.filters`; update existing Komoot/registry tests.
  - StravaProvider export routing (activity vs route → correct endpoint) with a
    mocked plugin bridge.
  - (If a polyline decoder is added) decoder table tests.
- **`SourceMenu.svelte`:** `svelte-check` + a light logic test for the
  connect/switch/sign-out actions; runtime verified on the emulator.
- **Build gates:** `pnpm test`, `pnpm check`, `pnpm build`, `compileDebugKotlin`,
  then install on the emulator and verify: connect second provider, switch
  sources, Komoot tours + filters visible, Strava Activities/Routes toggle,
  elevation gain populated.

## 6. Scope / sequencing

One spec, but the plan sequences so each part ships independently:
1. **Source menu + per-provider filters** (§1, §2) — no spike needed; pure
   client + UI. Delivers source switching, connecting the second provider, and
   Komoot tours/filters becoming reachable (fixes problem 1 and unblocks
   problem 2's Komoot half).
2. **Elevation fix** (§4) — small, no spike.
3. **Strava Routes** (§3) — gated on the mini-spike; adds the `routes` filter.

No version bump / AAB until an explicit "release". CHANGELOG `[Unreleased]` gets a
user-facing entry when these ship.

## 7. Out of scope (YAGNI)

- Per-source sign-out (the menu signs out everything).
- Sport-type filtering for Strava activities (the Activities/Routes toggle is the
  filter); revisit if requested.
- Strava share-intent (still deferred from the prior spec).
