# Changelog

All notable changes to **Export GPX for Komoot** (Android) are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions map to `versionName` / `versionCode` in `android/app/build.gradle`.

## [Unreleased] — 1.0.4 (versionCode 5)

### Added
- Banner ad at the bottom of the login screen (same adaptive banner as the tour list).
- Permanent inline tip on the tour list explaining the share-from-Komoot flow
  (Komoot → Share → Export GPX).
- Reminder modal ("Did you know?") about the share feature — pops up at most
  once every 14 days; the first launch only sets the baseline.
- The same share tip on the login screen, so new users learn the flow before
  signing in.

### Changed
- Public contact domain switched from `velologic-labs.com` to
  `velologic-labs.eu` (privacy policy, Play listing copy, data safety doc).
  `app-ads.txt` is served from `https://velologic-labs.eu/app-ads.txt`.

## [1.0.3] (versionCode 4) — 2026-05-12

### Fixed
- Status bar and navigation bar icons were drawn light-on-light and invisible
  on the app's white background. Icons now render dark (theme +
  `WindowInsetsControllerCompat`).

## [1.0.2] (versionCode 3) — 2026-05-12

### Fixed
- Android 15 enforces edge-to-edge: app content no longer draws under the
  status bar / navigation bar (`safe-area-inset` padding on header and main).
- The medium-rectangle ad in the "Saved!" modal rendered outside the card.
  The modal now anchors a 300×250 slot at the viewport center, exactly where
  the native AdMob banner appears.

## [1.0.1] (versionCode 2) — 2026-05-12

First release published to the Play Store internal testing track.

### Changed
- `targetSdk` / `compileSdk` raised 34 → 35 (Android 15), required by Google
  Play for new releases.

## [1.0] (versionCode 1) — 2026-05-11

Initial build (never released: superseded by 1.0.1 before review passed).

### Added
- **Sign in with Komoot** via an in-app WebView; the app never sees the
  password — it captures the session cookie and exchanges it for a long-lived
  token natively (Kotlin `KomootAuthPlugin`).
- **Tour list** of all recorded and planned tours from the user's Komoot
  account, with paging ("Show more").
- **Real OSM map thumbnails** for every tour (Leaflet + OpenStreetMap tiles,
  lazy-loaded, all interactions disabled).
- **Completed / Planned filter chips** (server-side filtering).
- **Tour detail page** with route preview map and stats.
- **GPX export** (GPX 1.1 with metadata and XML escaping) saved through the
  system file picker (Storage Access Framework); large tours staged via
  cacheDir to avoid binder limits.
- **Share intent**: sharing a tour from the Komoot app (Share → Export GPX)
  opens that tour directly; if signed out, the tour is remembered and opens
  right after login. Handles locale-prefixed URLs (`komoot.com/pl-pl/tour/…`).
- **"Saved!" modal** after a successful export.
- **Ads** (Google AdMob + UMP consent): adaptive banner on the tour list,
  medium rectangle in the Saved modal. Post-save interstitial implemented but
  disabled behind a Phase-2 flag (retention-first ad strategy).
- VeloLogic Labs branding: green route-line launcher icons, Play Store
  marketing assets, "Not affiliated with komoot GmbH" disclaimers.
- Release signing via upload keystore (Play App Signing).
