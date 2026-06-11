# Release checklist — 1.1.0 (Komoot + Strava)

**App:** Export GPX · `com.velologiclabs.gpxexporter`
**This build:** `versionName 1.1.0`, `versionCode 8`, signed with the upload key.

Tick each box. Order matters where noted.

---

## 0. Pre-flight (local, already done — just confirm)

- [ ] AAB exists and is signed:
      `mobile/android/app/build/outputs/bundle/release/app-release.aab`
      (`jarsigner -verify <aab>` → "jar verified.")
- [ ] `versionCode 8` is **higher** than the last build you uploaded to Play.
      (Last was 1.0.6 / code 7. If Play rejects "version code already used",
      bump `versionCode` in `mobile/android/app/build.gradle`, rebuild:
      `cd mobile/android && ./gradlew bundleRelease`.)
- [ ] Git is committed (it is). Optional: tag the release after publishing
      (see step 9).

---

## 1. Privacy policy must be live FIRST

- [ ] Open https://kubakunc.github.io/komoot-to-gpx/privacy-policy/ — it must
      load and mention **both Komoot and Strava** before you submit for review.

---

## 2. Play Console → create the release

Play Console → your app → **Release**.

- [ ] Pick the track:
      - **Internal testing** first (recommended — fast review, sanity-check on
        a real install), then promote to Production; **or**
      - **Production** directly if you're confident.
- [ ] **Create new release**.
- [ ] Confirm **Play App Signing** is enabled (it re-signs with the app key;
      your upload key just authenticates the upload).
- [ ] **Upload** `app-release.aab`.
- [ ] Paste **Release notes / "What's new"** (English, ≤ 500 chars):

```
Now works with Strava too! Sign in with Strava and export your activities and planned routes as GPX — switch between Komoot and Strava with one tap, or share straight from either app.

Also in this update:
• A fresh app icon and a simpler name — Export GPX.
• Stay signed in to Komoot — no more re-login after a while.
• Sharing a tour now opens reliably, even from a closed app.
• Strava activities show elevation gain.
```

---

## 3. Store listing — main (default language)

Source copy: `docs/ops/play-store-listing.md`.

- [ ] **App name:** `Export GPX`
- [ ] **Short description** (≤ 80): paste from the doc.
- [ ] **Full description**: paste from the doc.
- [ ] Confirm the **dual disclaimer** ("Not affiliated with komoot/Strava") is
      in the full description.

## 3b. Localized listings (optional but recommended for discoverability)

Source copy: `docs/ops/play-store-listing-{de,nl,fr,it,es,pl}.md`.

- [ ] For each locale you want: set **localized title** =
      `Export GPX for Komoot, Strava`, and paste the localized short + full
      descriptions. (This is where "Strava" lives in the title — not the
      default app name.)

---

## 4. Graphics (Main store listing → Graphics)

All under `mobile/marketing/`.

- [ ] **App icon** 512×512: `out/icon-hires-512.png`
- [ ] **Feature graphic** 1024×500: `out/feature-graphic.png`
- [ ] **Phone screenshots** (these four, in order):
      - `screenshots/01-sign-in.png`
      - `screenshots/02-strava-routes.png`
      - `screenshots/03-komoot-tours.png`
      - `screenshots/04-export.png`
- [ ] (Optional extra promo) `out/features-share.png` as a 5th screenshot if you
      want — it's branded and PII-free.

---

## 5. Data safety (App content → Data safety)

- [ ] **Data collected:** anonymous app activity + crash logs (Firebase),
      advertising ID (AdMob). Location/tour data is **not** collected by us
      (flows phone ↔ Komoot/Strava directly; no backend).
- [ ] **Encrypted in transit:** **Yes**.
- [ ] **Users can request deletion:** as applicable (no account on our side).
- [ ] Match the answers to `docs/ops/` Data Safety notes if present.

---

## 6. Content rating & audience

- [ ] **Content rating questionnaire:** answer all "No" (see table in
      `play-store-listing.md`) → expect Everyone / PEGI 3.
- [ ] **Target audience:** 18+, not appealing to children.
- [ ] **Ads:** declare **Yes, contains ads**.

---

## 7. App access (reviewer needs to sign in)

The app needs a Komoot/Strava account, so Google's reviewer must be given one.

- [ ] Provide test credentials in **App access → All functionality**:
      create a throwaway **Komoot** account (1 private + 1 planned tour) and/or
      a throwaway **Strava** account (1 activity + 1 route), and paste the
      login in the instructions field.
      ⚠️ Don't use your personal account.

---

## 8. Contact details & final submit

- [ ] **Contact email:** `contact@velologic-labs.com`
      (NB: `play-store-listing.md` still shows the old `.eu` — use `.com`,
      your current public contact.)
- [ ] **Website:** `https://velologic-labs.eu` (or your current site).
- [ ] **Privacy policy URL:** `https://kubakunc.github.io/komoot-to-gpx/privacy-policy/`
- [ ] Resolve any remaining **"errors"** Play flags on the release dashboard.
- [ ] **Send for review** (Save → Review release → Start rollout).

---

## 9. After it's published (local bookkeeping)

- [ ] Tag the release in git:
      `git tag -a v1.1.0 -m "Export GPX 1.1.0 — Komoot + Strava" && git push --tags`
- [ ] Keep the next changelog section ready: add a fresh `## [Unreleased]`
      heading at the top of `mobile/CHANGELOG.md` for future work.
- [ ] (If you maintain the web landing) deploy any landing-page updates by FTP.

---

## Quick reference — where everything is

| Thing | Path / value |
|---|---|
| Signed AAB | `mobile/android/app/build/outputs/bundle/release/app-release.aab` |
| Version | `1.1.0` / `versionCode 8` |
| Icon 512 | `mobile/marketing/out/icon-hires-512.png` |
| Feature graphic | `mobile/marketing/out/feature-graphic.png` |
| Screenshots | `mobile/marketing/screenshots/01..04-*.png` |
| Listing copy | `docs/ops/play-store-listing*.md` |
| Privacy policy | https://kubakunc.github.io/komoot-to-gpx/privacy-policy/ |
| Package | `com.velologiclabs.gpxexporter` |
