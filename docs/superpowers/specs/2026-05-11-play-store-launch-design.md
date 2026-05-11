# Play Store Launch — design

**Date:** 2026-05-11
**Status:** approved
**Bundle ID:** `com.jkcs.gpxexporter`
**App name:** Export GPX for Komoot
**Publisher:** Jakub Kunc Cloud Solutions

## 1. Goal

Repackage the existing PWA `komoot-to-gpx` as a native Android app distributed through Google Play. Eliminate password storage by replacing the email/password form with an in-app WebView pointed at `komoot.com/signin`, then intercept the Komoot session cookie after a successful login.

## 2. Strategic decisions

| Topic | Decision | Why |
|---|---|---|
| Authentication | WebView login on komoot.com + cookie intercept | No password ever touches our code → smallest legal/privacy surface, easier to defend on Play Data Safety |
| Platform | Android first (Play Store); iOS revisited after 6 months | Apple is much stricter about unofficial 3rd-party APIs; cheaper and faster to validate on Android |
| Monetization | Free + Google AdMob banner | Validates niche cheaply; revenue is bonus while we don't know if app survives DMCA risk |
| App name | "Export GPX for Komoot" | "For [trademark]" pattern is accepted; preserves SEO; carries explicit "Not affiliated" disclaimer in description |
| Bundle ID | `com.jkcs.gpxexporter` | Final on first upload, chosen up front |
| Publisher | Jakub Kunc Cloud Solutions | Company name on Play listing |

## 3. Residual risks (accepted)

- **Komoot DMCA / policy complaint** to Google → app removed, possibly publisher account warned. Lower than before (no automated authentication, user signs in manually), but non-zero.
- **Trademark dispute** for "Komoot" in title. Mitigated by "for Komoot" wording + "Not affiliated with komoot GmbH" disclaimer.
- **API drift**. Komoot can change session cookie name or `/v007` shape at any moment → app stops working until a release goes out.

## 4. Architecture

### 4.1 Repository layout

The existing PWA is preserved unchanged. The native app lives in a sibling folder. Both apps stay in the same git repo.

```
komoot-to-gpx/
├── docs/                       # specs, plans (shared)
├── web/                        # existing PWA, moved here verbatim
│   ├── package.json
│   ├── svelte.config.js        # adapter-node
│   ├── src/                    # current SvelteKit code (server + client)
│   ├── static/
│   ├── tests/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── README.md
└── mobile/                     # new Capacitor + SvelteKit SPA app
    ├── package.json
    ├── svelte.config.js        # adapter-static
    ├── capacitor.config.ts
    ├── src/                    # SPA only: no /api routes, no /lib/server
    ├── android/                # Capacitor-generated Android project
    │   └── app/src/main/java/com/jkcs/gpxexporter/
    │       ├── MainActivity.kt
    │       ├── KomootAuthPlugin.kt
    │       └── LoginActivity.kt
    ├── static/
    └── tests/
```

The two apps share **no package.json or workspaces** in v1 — duplication is accepted while `mobile/` stabilizes. If duplication becomes a maintenance burden, factor out shared modules (`komoot.ts`, `gpx.ts`, `MiniMap.svelte`) into a third package later.

### 4.2 Mobile app architecture

```
┌──────────────────────────────────────────────────────┐
│  Android APK — com.jkcs.gpxexporter                  │
│                                                       │
│  ┌────────────────────────────────────────────────┐  │
│  │ Native (Kotlin)                                │  │
│  │  • MainActivity — Capacitor host               │  │
│  │  • KomootAuthPlugin — WebView login + cookies  │  │
│  │  • AdMob plugin (@capacitor-community/admob)   │  │
│  │  • HTTP plugin (@capacitor/http) — bypass CORS │  │
│  └────────────────────────────────────────────────┘  │
│                       ↕  bridge (JSON)                │
│  ┌────────────────────────────────────────────────┐  │
│  │ Web layer (SvelteKit SPA, adapter-static)      │  │
│  │  • routes/+page.svelte (list)                  │  │
│  │  • routes/tour/[id]/+page.svelte (map)         │  │
│  │  • routes/login/+page.svelte (CTA only)        │  │
│  │  • lib/client/komoot.ts (API + auth wrapper)   │  │
│  │  • lib/client/gpx.ts (XML generation)          │  │
│  │  • lib/client/MiniMap.svelte (SVG preview)     │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
                       │ HTTPS
                       ▼
              ┌─────────────────────────────┐
              │  api.komoot.de              │
              │  + tile.openstreetmap.org   │
              │  + googleads.g.doubleclick. │
              │    net (AdMob)              │
              └─────────────────────────────┘
```

No backend server for the mobile app. The SvelteKit SPA compiles to static files inside `mobile/android/app/src/main/assets/public`. The native shell packages everything into one AAB.

The `web/` app continues to use its existing SvelteKit + adapter-node + proxy architecture; it is not affected by this work.

## 5. Login flow (the new core)

```
1. User taps "Sign in with Komoot" on /login
2. JS calls KomootAuth.login()   (custom Capacitor plugin)
3. Kotlin (KomootAuthPlugin):
   a. Launches a fullscreen Activity hosting a WebView
   b. WebView loads https://www.komoot.com/signin
   c. User signs in normally (incl. 2FA, CAPTCHA, social login)
   d. WebViewClient.shouldOverrideUrlLoading watches navigations.
      When URL matches komoot.com/discover (post-login redirect):
      → CookieManager.getCookie("https://www.komoot.com")
      → returns the cookie string as plugin result
4. JS receives cookies, performs:
   GET https://api.komoot.de/v006/account/  with Cookie: <captured>
5. Komoot returns { username (userId), password (long-lived token), email }
6. JS stores { userId, token, email, cookies } in Capacitor Preferences
   (encrypted via Android Keystore)
7. Redirect to / (tour list)
```

Once we have `{ userId, token, email }`, the rest of the API client works identically to today's code: Basic auth `email:token` against `api.komoot.de/v007/...`. The cookie intercept is only the entry point; the bulk of the client is reused.

Token expiry: if any subsequent call returns 401 → clear stored session → push user back to `/login` → reopen WebView.

## 6. Code changes

### 6.1 Step zero: relocate existing PWA

Move the entire current repo content (everything except `docs/` and `.git/`) into a new `web/` subfolder, in a single commit, with no source changes. After the move:

- `web/package.json`, `web/svelte.config.js`, `web/src/...`, etc. — untouched contents.
- Verify `cd web && pnpm install && pnpm test && pnpm build` still passes.
- Update `web/README.md` to mention the move.

Top-level `docs/`, `MEMORY.md`, root `.git/` stay where they are.

### 6.2 Bootstrap the mobile app

Create `mobile/` by copying `web/` and adapting:

#### Delete (in `mobile/`)
- `src/lib/server/*` (komoot.ts, gpx.ts, rate-limit.ts)
- `src/routes/api/*` (auth, tours, tours/[id]/gpx, tours/[id]/preview, tours/[id]/shape)
- `Dockerfile`, `docker-compose.yml`
- `playwright.config.ts`, `tests/e2e/*`
- `@sveltejs/adapter-node` dependency

#### Move 1:1 (server → client)
- `lib/server/komoot.ts` → `lib/client/komoot.ts`. Replace `fetch` with `CapacitorHttp.request()`. Identical function signatures. Unit tests reuse same shape, only mock target changes.
- `lib/server/gpx.ts` → `lib/client/gpx.ts`. No changes — pure function.

#### Add (in `mobile/`)
- `capacitor.config.ts`
- `android/` (generated by `npx cap add android`, then customized)
- `android/app/src/main/java/com/jkcs/gpxexporter/KomootAuthPlugin.kt` (~120 LOC)
- `android/app/src/main/java/com/jkcs/gpxexporter/LoginActivity.kt` (~80 LOC)
- `android/app/src/main/res/layout/activity_login.xml`
- `src/lib/client/komoot-auth.ts` — typed wrapper over the Capacitor plugin
- `src/lib/client/secure-storage.ts` — wrapper over Capacitor Preferences
- `src/lib/client/ad-banner.ts` — AdMob init + banner show/hide
- `svelte.config.js` swap: `adapter-static` (output to `build/`, fallback `index.html` for SPA routing)

#### Modify UI (in `mobile/`)
- `login/+page.svelte`: drop email/password form. One big "Sign in with Komoot" button that calls `KomootAuth.login()`. Intro paragraph explaining the WebView flow.
- `+page.svelte`: add `<div id="banner-anchor">` near the footer; initialize AdMob banner on mount, hide on unmount.
- `+layout.svelte`: header shows `userdisplayname` (from `/v006/account/`) instead of email. "Sign out" button clears stored session and reopens WebView next time.

The `web/` app is **not** modified by any of these steps and continues to work as before.

## 7. Privacy policy + Play Data Safety

### Privacy policy (hosted as a static GitHub Pages site)
- Authentication: your Komoot password is entered exclusively on the official `komoot.com` page loaded inside our in-app WebView. The app never has access to your password and never transmits it.
- Session: Komoot session cookies and the long-lived token are stored only on your device, encrypted via Android Keystore (Capacitor Preferences).
- Network: the app communicates only with `api.komoot.de` (tour data), `tile.openstreetmap.org` (maps), and Google AdMob servers (ads).
- Tour data: nothing leaves your device beyond the GPX file you explicitly download.
- AdMob: Google AdMob collects Advertising ID, IP, ad-related diagnostics (linked Google policy).
- No analytics, no crash reporting in v1.
- Consent: UMP consent can be reset by clearing app data (Android Settings → Apps → Export GPX for Komoot → Clear storage). A dedicated in-app Settings screen is out of scope for v1.
- Contact: kunc@chaosgears.com (placeholder — confirm before publishing).

### Data Safety form on Play (checklist)
- **Data shared with third parties: YES** — AdMob (AdvID, IP, performance).
- **Data collected by the app: NO** — no PII collection, password is never stored.
- **Encrypted in transit: YES** — HTTPS only.
- **User can request deletion: YES** — uninstall + Sign out flow.

## 8. AdMob + UMP

- **Format:** adaptive banner, ~50 dp height. Bottom-of-list on `/`.
- **No ads on:** login screen, tour detail (map deserves the whole screen), splash.
- **UMP consent:** on first launch in EU regions, `AdMob.requestConsentInfo()` shows the EU-mandated dialog before any ad loads. Non-personalized ads if user declines.
- **Test units (dev):** Google test banner `ca-app-pub-3940256099942544/6300978111`. **Prod:** real AdMob ad unit configured after account creation.
- **No interstitial, no rewarded, no native ads** in v1.

## 9. Play Store assets

| Asset | Spec | Notes |
|---|---|---|
| App icon (hi-res) | 512×512 PNG | minimalist mark — small arrow over a stylized route |
| Adaptive icon | 432×432 foreground + solid bg | derived from hi-res |
| Feature graphic | 1024×500 PNG | minimal: brand + tagline on light background |
| Phone screenshots | ≥ 2, ideally 4-6 at 1080×1920 | login screen, tour list with mini-maps, tour detail with full map, GPX action |
| Short description | ≤ 80 chars | "Export your private Komoot tours as GPX files." |
| Full description | ≤ 4000 chars | features bullet list + "Not affiliated with komoot GmbH" disclaimer + privacy policy link |
| Category | Maps & Navigation | secondary: Sports |
| Content rating | "Everyone" | confirmed by IARC questionnaire |
| Privacy policy URL | https://... | GitHub Pages |

## 10. Release flow

- **Signing:** generate `upload-keystore.jks` locally with `keytool`, store in 1Password + encrypted offsite backup. Enroll into **Play App Signing** — Google holds the app-signing key; we keep the upload key.
- **Build:** `pnpm build && npx cap sync android && cd android && ./gradlew bundleRelease`. Outputs AAB at `android/app/build/outputs/bundle/release/app-release.aab`.
- **Tracks:**
  1. **Internal testing** (≤ 100 emails, ~1-2 h review). All initial Komoot login validation on real devices.
  2. **Closed testing (alpha)** — invite link, 10-50 testers (friends/family). 1-2 day review.
  3. **Open testing (beta)** — public opt-in. First "stable" build.
  4. **Production** — after 1-2 weeks of crash-free beta. First production review can take 2-7 days.
- **Versioning:** SemVer in `package.json` → `versionName` in `android/app/build.gradle`. `versionCode` = `major*10000 + minor*100 + patch` (deterministic, monotonic).

## 11. Out of scope (v1)

- iOS / App Store
- Subscriptions, freemium, paid tier
- Crash reporting (Sentry / Firebase Crashlytics)
- Analytics (PostHog, GA, Firebase Analytics)
- Offline tour cache / background sync
- Push notifications
- Deep linking (`komoot.com/tour/X` → opens app)
- Share intent to Garmin Connect / Strava / etc.
- Bulk export, filters, search
- Highlights / waypoints in GPX
- Refresh-token / silent re-auth
