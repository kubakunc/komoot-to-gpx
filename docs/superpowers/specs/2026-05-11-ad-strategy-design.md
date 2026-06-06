# Ad Strategy — design (v1 + roadmap)

**Date:** 2026-05-11
**Status:** approved
**App:** Export GPX for Komoot (`com.velologiclabs.gpxexporter`)
**Publisher:** VeloLogic Labs

## 1. Strategic decisions

| Topic | Decision | Why |
|---|---|---|
| Priority on launch | **Retention #1, revenue = bonus** | Komoot users are UX-sensitive (high-end GPS gear buyers); 1-star reviews from intrusive ads will sink Play Store ranking irreversibly |
| In-app purchases (Remove Ads) | **Not in v1** | Implementation friction, low conversion before social proof, can ship in v2 |
| Analytics infrastructure | **AdMob Console + Play Console only** | Keeps Data Safety form clean; covers 80% of needed metrics with zero in-app code |
| Acceptable churn from ads | < 5% measurable uninstall lift attributable to ads | Watch Play Console "User acquisition" + "Reviews" weekly |

## 2. Ad slots — v1 (active)

### 2.1 Sticky banner — tour list

- **Where:** bottom of `/` (tour list), pinned to safe area
- **Format:** Adaptive Banner (~50 dp height)
- **Lifecycle:** initialized on mount, removed on unmount or sign-out
- **AdMob units:**
  - Dev / debug build: `ca-app-pub-3940256099942544/6300978111` (Google's test banner)
  - Production: live AdMob unit (created in Phase A1, see roadmap)
- **Expected eCPM:** $0.5–1.5 (US-leaning English-speaking outdoor audience)
- **UX impact:** lowest — siedzi na dole, scroll'ujesz nad nim

### 2.2 Medium Rectangle — Saved! modal

- **Where:** `SavedModal.svelte`, rendered center-screen after every successful GPX save
- **Format:** Medium Rectangle 300×250
- **Lifecycle:** shown on modal mount, hidden on close; sticky banner is hidden while modal is open and re-shown after close
- **AdMob units:** same test/prod pair as the sticky banner in v1 (could be split into a dedicated unit later for separate reporting)
- **Expected eCPM:** $1–3 (high attention — user just successfully exported a file, satisfaction state)
- **UX impact:** low — modal already shows for user feedback; ad replaces nothing

### 2.3 Slot interaction rules

- **One banner at a time.** Showing the Medium Rectangle automatically hides the sticky banner; closing the modal restores it. Single-banner-at-a-time enforced in `lib/client/ad-banner.ts` via internal state flags.
- **No ad on `/login`.** Login is conversion-critical; we want zero friction.
- **No ad on `/tour/[id]`.** The map is the visual centerpiece; banner would hurt the perceived quality of the app.

## 3. What we explicitly DO NOT ship in v1

| Format | Why excluded |
|---|---|
| **Interstitial** | Full-screen takeover for utility app = uninstall driver. Reconsidered in Phase 2 only if data justifies. |
| **App Open Ad** | Highest churn predictor for utility apps. Permanently excluded. |
| **Native ads in list cards** | Mixing real tours with sponsored cards looks scammy in a private-data app. |
| **Rewarded ads** | No premium feature to gate behind a reward yet. Slot reserved for bulk export (v2). |
| **Banner on tour detail / map** | Map is the flagship visual; ad cheapens the screen. |

## 4. Privacy & Data Safety

### 4.1 Privacy policy (hosted on GitHub Pages, link in Play listing)

Plain-language sections:

1. **What we collect:** Nothing directly. AdMob (Google) collects Advertising ID, IP, and device/ad performance signals on our behalf — covered by [Google's policy](https://policies.google.com/technologies/partner-sites).
2. **What we don't collect:** Names, emails, GPS data, tour content, contacts, location.
3. **Where Komoot session lives:** On your device, encrypted via Android Keystore. We never see your password.
4. **How to opt out / reset:** UMP consent can be reset by clearing app data (Android Settings → Apps → Export GPX for Komoot → Clear storage).
5. **Contact:** contact@velologic-labs.eu (replace with real publisher contact before going live).

### 4.2 Play Data Safety form (declarations)

- **Data shared with third parties: YES**
  - Provider: Google AdMob
  - Categories: Advertising or marketing, App functionality
  - Types: Device IDs (Advertising ID), Approximate location (IP-derived), Other diagnostics
- **Data collected by app itself: NO**
- **Data encrypted in transit: YES** (HTTPS to api.komoot.de, tile.openstreetmap.org, ad servers)
- **Users can request deletion: YES** (uninstall + sign-out)

## 5. UMP (User Messaging Platform) consent

- Mandatory consent dialog shown to EU/EEA/UK users on first launch.
- Implementation: `@capacitor-community/admob` `requestConsentInfo()` + `showConsentForm()` (already implemented).
- If user declines: AdMob plugin automatically serves **non-personalized ads only**. Lower eCPM (~30% drop typical) but legally compliant and ethically clean.
- Reset path: clear app data (no dedicated Settings screen in v1).

## 6. Measurement & decision triggers

### 6.1 Weekly review (manual, ~10 min)

Open three dashboards:

1. **Play Console → Vitals → User acquisition / Retention** — DAU, MAU, day-1/day-7/day-30 retention
2. **Play Console → Ratings & reviews** — fresh reviews, especially 1–2 ★ mentioning ads
3. **AdMob Console → Reports** — impressions per ad unit, eCPM, revenue per day

### 6.2 Decision triggers (when to change strategy)

| Signal | Threshold | Action |
|---|---|---|
| 1–2★ reviews mentioning "ads" | ≥ 2 in any week | Soften ads (reduce frequency, smaller rect) |
| Day-7 retention | < 20% | Pause new ad slots, investigate |
| MAU | ≥ 1,000 | Phase 2 unlocked — consider interstitial pilot |
| MAU | ≥ 5,000 | Phase 3 unlocked — Remove Ads IAP |
| Total revenue | < $5/month after 3 months | Re-evaluate: either add interstitial despite UX, or sunset ads + ask for donations |
| Komoot DMCA notice | any | Pull from Play Store immediately; revisit strategy entirely |

## 7. Roadmap

### Phase 0 — v1 launch (now)
- Sticky banner on `/`
- Medium Rectangle in Saved! modal
- UMP consent for EU
- Test AdMob units (replace with prod IDs as last step before going live)

### Phase 1 — production cutover (week before Play submission)
- Create AdMob app + 2 ad units (banner, medium rectangle)
- Swap test IDs → prod IDs in `lib/client/ad-banner.ts`
- Fill Play Data Safety form
- Publish privacy policy on GitHub Pages
- Submit to Play **internal testing** track first

### Phase 2 — interstitial pilot (after ≥ 1,000 MAU)
- **Only if** weekly reviews show stable retention and no ad-related complaints
- Interstitial after every 5th successful GPX save, max 1/day, ≥ 60s after app start
- Monitor week-over-week retention delta closely; revert if drop > 3 pp
- Optional: add minimal PostHog tracking for save-event → impression → 24h-retention funnel

### Phase 3 — Remove Ads IAP (after ≥ 5,000 MAU and stable Phase 2)
- Google Play Billing integration
- Single non-consumable: "Remove ads forever" at $1.99
- "Remove ads" button at the bottom of Saved! modal (low-friction entry point)
- Keep ads as default; IAP is opt-in

### Phase 4 — Rewarded ad for bulk export (when bulk export ships)
- Bulk export of multiple tours = power-user feature
- Free users: 1 free bulk per week
- Watch rewarded ad: +1 bulk that day
- IAP holders: unlimited

## 8. Out of scope (v1)

- A/B testing infrastructure (Firebase Remote Config, etc.) — premature before user base
- Custom analytics (PostHog/Plausible) — Phase 2 only if interstitial pilot needs measurement
- Native ads in tour cards — never (legitimacy reasons)
- Banner on `/tour/[id]` — never (UX flagship)
- App Open Ad — never
- Subscription-based monetization
- Programmatic ad mediation (AdMob mediation with Meta/Unity Ads) — Phase 3+
