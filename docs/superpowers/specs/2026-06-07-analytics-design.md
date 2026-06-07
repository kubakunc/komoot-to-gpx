# Usage Analytics & Crash Reporting — Design

**Date:** 2026-06-07
**Goal:** see how users actually use *Export GPX for Komoot* — conversion
funnel (login → list → export), feature usage (share intent, filters),
retention, and crashes — with Google Firebase Analytics + Crashlytics.

## 1. Architecture

- **Firebase project** (user creates in the Firebase console, adds Android
  app `com.velologiclabs.gpxexporter`, downloads `google-services.json`).
- **Gradle wiring:** `google-services` + `firebase-crashlytics` Gradle
  plugins in `mobile/android/build.gradle` and `app/build.gradle`;
  `google-services.json` lands in `mobile/android/app/` (committed — it
  contains only public identifiers).
- **Capacitor plugins:** `@capacitor-firebase/analytics@6.x` and
  `@capacitor-firebase/crashlytics@6.x` (native Firebase SDK under the hood).
- **Single wrapper module** `mobile/src/lib/client/analytics.ts`:
  - `track(event, params?)` — fire-and-forget, catches and warns, no-ops on
    non-Android platforms (same pattern as `ad-banner.ts` / `review.ts`).
  - Event names exported as constants from this module; the rest of the
    codebase never imports Firebase directly.
  - `recordError(e, context)` — wraps Crashlytics `recordException` for
    non-fatal errors in critical catch blocks.
  - `applyAnalyticsConsent(granted: boolean)` — see §3.

## 2. Event taxonomy

Intentionally small. Screen views, sessions, DAU/MAU, retention cohorts and
uninstall metrics come free with the SDK — no custom events needed for them.

| Event | Params | Question it answers |
|---|---|---|
| `login_success` | — | how many installs convert to a working account |
| `login_fail` | `reason` (`cancelled` \| `error`) | is the WebView login a blocker |
| `export_success` | `source` (`list` \| `detail` \| `share`) | the north-star metric + which path users take |
| `export_fail` | `reason` (`api` \| `save` \| `auth`) | where exports break |
| `share_intent_received` | `signed_in` (`true`/`false`) | is the share-from-Komoot feature used at all |
| `filter_change` | `filter` (`all` \| `recorded` \| `planned`) | do filters matter |
| `review_prompt_shown` | — | calibrate the rating-prompt cadence |

Instrumentation points:
- `login/+page.svelte` `signIn()` — success and both error branches.
- Both save flows (`+page.svelte` `download()`, `tour/[id]` save) — success
  with source, failure with reason. The `share` source applies when the tour
  page was reached via a share intent (tracked via the existing
  `share-intent` flow: hash navigation sets a flag consumed by the tour page).
- `+layout.svelte` `handleShareHash()` — `share_intent_received`.
- `+page.svelte` `setFilter()` — `filter_change`.
- `review.ts` `maybeRequestReview()` — `review_prompt_shown` when the
  decision function says yes (the OS dialog itself is invisible to us).

Crashlytics: automatic for crashes; `recordError` added in the
login-extraction catch (LoginActivity already logs there natively — JS-side
catches in both save flows call `recordError` with the failure reason).

## 3. Consent (EEA) — Google Consent Mode

The app already runs the UMP consent flow for AdMob (`initAds()` in
`ad-banner.ts`). After UMP resolves:

- consent obtained or not required → `applyAnalyticsConsent(true)` →
  `setConsent({ analyticsStorage: 'granted' })`
- consent denied → `applyAnalyticsConsent(false)` → `analyticsStorage:
  'denied'` (Firebase then collects only anonymous, ID-less pings).

Crashlytics collection stays always-on (legitimate interest — crash logs,
no advertising use). No second consent dialog.

## 4. Documentation obligations (required before the release ships)

- **Privacy policy** (`docs/privacy-policy/index.html`): new section
  "Analytics & crash reporting" — names Firebase Analytics + Crashlytics,
  lists what is collected (app interactions, crash logs, diagnostics,
  device identifiers), states the consent behavior from §3, links Google's
  privacy policy. Soften the "collects no personal information" claim to
  match. Bump "Last updated".
- **Play Data Safety** (`docs/ops/play-data-safety.md`): add collected data
  types — App interactions, Crash logs, Diagnostics, Device or other IDs;
  purpose Analytics; processed ephemerally: no; shared: no (Google acts as
  processor).
- **Play listing PRIVACY paragraph** (EN + de/nl/fr/it/es/pl files): add one
  sentence: anonymous usage statistics and crash reports help improve the
  app; consent is asked in the EEA.

## 5. Testing & verification

- Unit tests for the wrapper: event constants exported, `track()` no-ops
  off-Android, consent mapping function pure logic.
- Manual: Firebase DebugView with
  `adb shell setprop debug.firebase.analytics.app com.velologiclabs.gpxexporter`
  — verify each event fires from the emulator.
- Crashlytics: force a test crash behind a debug-only hook, verify it lands
  in the console.

## Out of scope

- BigQuery export, custom dashboards, funnels beyond Firebase's built-ins.
- iOS (app is Android-only).
- A/B testing / Remote Config.
