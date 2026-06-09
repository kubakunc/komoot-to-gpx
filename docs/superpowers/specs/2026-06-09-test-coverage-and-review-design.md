# Test coverage + whole-code review + CI — design

**Date:** 2026-06-09
**Status:** Approved (brainstorming) — ready for implementation plan
**App:** Export GPX for Komoot, Strava (Android, Capacitor 6 + SvelteKit/Svelte 5)

## Goal

A **lightweight, fast, stable, bug-free** app — not a monster. Stop catching
bugs by hand on the emulator. Achieve it with: a full code review (+fixes),
unit tests for all logic, lean "smoke" coverage of the bug-prone flows (via
logic extraction, not heavy component-test infra), and CI that runs the checks
automatically.

## Testing philosophy (the guardrail against a monster)

- **Test pure logic, not the framework.** Extract bug-prone logic out of Svelte
  components into pure functions and unit-test those. No jsdom/component-test
  harness, no E2E framework.
- **The native layer is verified on-device only.** Cookie replay, CSRF scraping,
  the WebView login, Cloudflare behaviour — not unit-testable; covered by the
  spikes + manual on-device checks.
- **Mock the Capacitor bridge** (`registerPlugin`) for client modules, as the
  existing tests already do.
- Vitest, node env (current setup). No new test runtime.

## 1. Whole-code review + fixes

1. **Build a graphify code graph** of `mobile/src` (`/graphify mobile/src`) — a
   dependency map for navigating the review and spotting coupling/god-nodes.
   (Honors "use graphify for searching".)
2. **Run the `code-review` skill** at high effort over the multi-provider
   surface (everything from commit `f2a5ffb` to HEAD, plus the touched legacy
   files). Correctness bugs first, then reuse/simplification/efficiency.
3. **Svelte 5 runes review** of the `.svelte` files (`+layout`, `+page`,
   `tour/[id]`, `login`, `SourceMenu`): `$state`/`$derived`/`$effect` correctness,
   effect dependency loops, stale closures, store subscriptions. Apply Svelte 5
   best practices (the `svelte-skills-kit` plugin failed to install — its
   marketplace name was wrong; use a focused review agent + the official runes
   rules instead).
4. **Triage and fix** real bugs and cheap cleanups only — no gold-plating. Also
   fix the two pre-existing `pnpm check` errors so "0 type errors" is true:
   - `analytics.ts:55` — `ConsentType` used as a type (use `typeof ConsentType`).
   - `MiniMap.svelte:29` — `tap` not a valid Leaflet `MapOptions` key.

## 2. Tests — fill the gaps + extract bug-prone logic

The biggest stability win, kept lean by **extracting logic from components into
pure helpers** (which also serves the review's DRY goal) and unit-testing them.

**Extract + test (new pure helpers):**
- `resolveActiveProvider(connected: ProviderId[], requested: ProviderId): ProviderId`
  — the active-source reconcile rule (source of the flash/desync bugs). Used by
  `+page.svelte` and `+layout.svelte`; currently inline/duplicated.
- `safeName(name: string): string` — GPX filename sanitiser, currently
  duplicated in `+page.svelte` and `tour/[id]/+page.svelte`. Move to a shared
  module (`gpx-filename.ts`), import in both, unit-test.
- `isProviderAuthError(e: unknown): boolean` — the 401-only auth-fail predicate,
  currently duplicated in both pages. Move to a shared module, unit-test (401 →
  true; 403/500/other → false; both `KomootError` and `StravaError`).

**New client tests (the modules where recent bugs lived):**
- `strava.ts` (mock the `StravaApi` plugin `get`/`post`):
  - `listActivities` — URL + page→`page+1`; 401 → StravaError(401); 5xx → 502;
    parses the activities fixture.
  - `listRoutes` — POSTs the expected body; **403 → StravaError(403), NOT 401**
    (must not sign out); 401 → 401; parses the routes fixture.
  - `getGpx` / `getRouteGpx` — non-`<` body → 422 ("no GPS track"); good GPX
    passes through; 401 vs other status.
  - `getStreamCoordinates` — passes the `latlng+altitude` path; non-200 → `[]`.
  - `getActivityName` — parses `<title>`, strips `| Strava`, tolerates failure.
- `providers/strava.ts` (mock `strava.ts`):
  - `listActivities({filter})` → routes to `listRoutes` for `'routes'`, else
    activities.
  - `getActivity`/`getGpx` → parse the id (`activity-`/`route-`) and call the
    correct underlying function (route export vs activity export/streams).

**Already covered (no change):** gpx, mappers (`strava-map`), `strava-id`,
`strava-gpx`, `session` (multi-provider + migration), `active-provider`,
registry, komoot, analytics, share-intent, share-hint, review, ad-config.

## 3. CI — run the checks automatically

- **GitHub Actions** workflow `.github/workflows/ci.yml`: on `push` and
  `pull_request`, set up Node 20 + pnpm, `pnpm install --frozen-lockfile` (in
  `mobile/`), then `pnpm test` and `pnpm check`. Fail the job on any failure.
- **No Android build in CI** (needs the SDK, signing secrets, and is slow) — the
  AAB stays a manual, explicit release step.
- Confirm the git remote is GitHub before writing the workflow. If there is no
  GitHub remote, fall back to a local `pre-push` git hook running the same two
  commands (documented as the durable alternative).
- `pnpm check` currently has the 2 pre-existing errors; CI is wired **after**
  Section 1 fixes them, so the pipeline starts green.

## 4. Out of scope (keeps it lean)

- Component tests (jsdom/`@testing-library/svelte`) — replaced by logic
  extraction + unit tests.
- E2E / device-automation framework.
- Native-layer unit tests (cookie/CSRF/WebView) — on-device + spikes only.
- Testing static map images, Leaflet rendering, ad/Firebase SDKs.
- No version bump / AAB (project rule: release only on explicit instruction).

## Sequencing

1. Section 1 review + fixes (incl. the 2 type errors + the 3 extractions, since
   extraction is both a review fix and a test enabler).
2. Section 2 tests (the extracted helpers are already in place from step 1).
3. Section 3 CI (green from the start because step 1 fixed the type errors).
