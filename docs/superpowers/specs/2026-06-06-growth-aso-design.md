# Growth: ASO + In-App Reviews + SEO Landing — Design

**Date:** 2026-06-06
**Goal:** grow installs of *Export GPX for Komoot* organically (budget: 0 zł,
maintenance: ≤1h/week, no community posting). Competitors sit at 50k–100k
installs; we are near zero.

**Strategy chosen:** A + C from brainstorm — localized Play listings + in-app
review prompt + SEO landing page. Full app i18n (option B) deferred until the
DE listing shows traction.

## 1. English listing sanitization + ASO

File: `docs/ops/play-store-listing.md` (paste targets in Play Console).

- **Remove the "WHY THIS APP EXISTS" section** — it mentions "paying for
  Komoot Premium", which violates our no-antagonizing-Komoot rule and is the
  only legally provocative line in the listing. Replace with a neutral
  use-case paragraph ("your routes on any device").
- **Short description** (80 chars, keyword real estate), target:
  `Export Komoot tours as GPX — for Garmin, Wahoo & any bike computer or watch.`
- **Full description**: weave in search phrases naturally (no stuffing):
  *komoot to gpx, export komoot tour, download gpx from komoot, komoot
  garmin, komoot wahoo, gpx file download*.
- App title stays **"Export GPX for Komoot"** (already keyword-strong).

## 2. Localized Play listings (app UI stays English)

Play Search ranks per-locale listings; a German searching "komoot gpx" is
ranked against the German listing. Komoot's user base is ~50% DACH.

- Languages: **de-DE, nl-NL, fr-FR, it-IT, es-ES, pl-PL**.
- Per language: short description + full description translated **for local
  search phrases** (e.g. DE: "Komoot Touren als GPX exportieren – für Garmin
  & Wahoo"), not literal translations.
- Title stays English everywhere (brand + already contains "GPX"/"Komoot").
- Screenshots stay English for now.
- Deliverables: `docs/ops/play-store-listing-de.md` (+ nl/fr/it/es/pl), one
  copy-paste block per Play Console field. User pastes via Store listing →
  Add language (~10 min).

## 3. In-app review prompt

Ratings are the strongest ASO ranking factor we control; competitors have
hundreds, we have ~0.

- Plugin: `@capacitor-community/in-app-review` (wraps Google Play In-App
  Review API — native bottom-sheet dialog, user never leaves the app).
- **Trigger:** after the user closes the "Saved!" modal following the
  **2nd successful GPX save** (reuses the existing `SAVE_COUNT_KEY` counter),
  then again every 5 saves (Google may silently throttle the dialog, so
  retrying is safe and invisible).
- Pure decision function `shouldRequestReview(saveCount)` in
  `src/lib/client/review.ts` + unit tests; the plugin call itself is
  fire-and-forget with catch-and-ignore (API gives no feedback by design).
- No Play Console configuration needed.

## 4. SEO landing page (static, FTP-deployed)

Target Google searches like "komoot export gpx", "download komoot tour gpx".

- **Stack: plain HTML + CSS, no framework, no build step.** Deployed by
  uploading files over FTP to the existing static server behind
  `velologic-labs.eu` (same host that serves `app-ads.txt`). No Docker.
- Repo location: `web-landing/` (e.g. `index.html`, `de/index.html`,
  `style.css`, `og-image.png`, `sitemap.xml`, `robots.txt`).
- Page structure: hero (name, one-liner, "Get it on Google Play" badge),
  3 phone screenshots, "How it works" (3 steps incl. share-from-Komoot),
  FAQ written as SEO questions ("How do I export a GPX file from Komoot?"),
  footer (privacy policy link, `contact@velologic-labs.eu`, "Not affiliated
  with komoot GmbH" disclaimer).
- SEO: meta title/description, `SoftwareApplication` JSON-LD, OpenGraph,
  `hreflang` pair EN ↔ DE (`/` and `/de/`), sitemap + robots.
- Languages: EN + DE now; more later if DE converts.

## 5. Tech debt rider (same release)

Play Console flags two "recommended actions" on 1.0.4 (targetSdk 35):

- `window.statusBarColor` is deprecated in API 35 — used in
  `LoginActivity.kt` for the black status bar. Replace with
  `WindowCompat.setDecorFitsSystemWindows(window, false)` + black root
  background + status-bar inset padding on the banner TextView.
- The second warning ("deprecated APIs for edge-to-edge") originates mostly
  in Capacitor 6 internals; ours is the part we can fix. Non-blocking.

## 6. Measurement (no code)

- Weekly glance at Play Console → Statistics → Store performance:
  impressions by country + search-term report. If DE impressions don't move
  within ~4 weeks of the DE listing going live, revisit keywords before
  considering app i18n.

## Out of scope

- Full app i18n (option B) — revisit after DE traction.
- Paid acquisition, community posting, influencers.
- Localized screenshots.
