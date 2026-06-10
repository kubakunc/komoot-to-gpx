# Changelog

User-facing changes to **Export GPX for Komoot, Strava** (Android).
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.0] — 2026-06-10

### Changed
- App launcher name is now **Export GPX** (shorter and source-neutral, so it
  fits both Komoot and Strava).
- **New app icon** — "route divider": Strava orange above the activity line,
  Komoot green below, with a download badge (from the brand design handoff).

### Added
- **Strava support.** Sign in with Strava and export your activities as GPX —
  the same one-tap save you already have for Komoot, right from your phone.
- **Strava planned Routes.** Switch between **Activities** and **Routes** when
  Strava is the active source, and export either as GPX.
- **Source menu in the header.** Tap the source name (top-right) to switch
  between Komoot and Strava, connect the other account without signing out, or
  sign out.
- Strava activities now show **elevation gain**.
- **Share from Strava.** In the Strava app, tap Share → Export GPX on any
  activity or route — it opens here ready to save. Works signed out too: the
  login screen tells you what's waiting, and it opens right after you sign in
  to Strava.

## [1.0.6] — 2026-06-07

### Added
- Anonymous usage statistics and crash reporting (Google Firebase) to help
  improve the app. Ad-related Firebase signals are disabled; in the EEA
  analytics activates only after the consent dialog.

## [1.0.5] — 2026-06-06

### Added
- After a successful export the app may ask for a quick Play Store rating
  (Google's standard in-app dialog, at most occasionally).

### Fixed
- Status bar styling on the Komoot sign-in screen no longer relies on a
  deprecated Android API.

## [1.0.4] — 2026-06-06

### Added
- Tips explaining the share flow: open a tour in the Komoot app, tap
  **Share → Export GPX**, and it opens here ready to save. Shown on the login
  screen and the tour list, plus a "Did you know?" reminder at most once
  every 14 days.
- A note above the Komoot sign-in page explaining that Google sign-in does
  not work inside apps (Google blocks it) — sign in with email and password,
  or use Komoot's "Can't log in?" link to set a password for a Google-only
  account.
- Banner ad on the login screen.

## [1.0.3] — 2026-05-12

### Fixed
- Clock, battery and other status-bar icons were invisible (white on white).

## [1.0.2] — 2026-05-12

### Fixed
- App content no longer draws underneath the status bar and navigation bar
  on Android 15.
- The ad in the "Saved!" dialog appeared outside the dialog box.

## [1.0.1] — 2026-05-12

Initial release (internal testing).

- **Sign in with Komoot** — a secure Komoot login page opens inside the app;
  the app never sees your password.
- **All your tours in one list** — recorded and planned routes from your
  Komoot account, with real map previews.
- **Completed / Planned filter.**
- **Tour details** with route preview and stats.
- **Export any tour as GPX** — standard GPX 1.1, saved where you choose,
  ready for bike computers and watches.
- **Share from Komoot** — share any tour from the Komoot app straight into
  this app; it opens ready to export. Works even when signed out: the tour
  opens right after you sign in.
- Ads: a small banner on the tour list and an ad in the "Saved!" dialog.
