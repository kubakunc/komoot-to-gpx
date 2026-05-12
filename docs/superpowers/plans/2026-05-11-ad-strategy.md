# Ad Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the v1 ad slots (already wired in code) all the way to a Play Store launch, with code scaffolding ready for the Phase 2 interstitial pilot when MAU thresholds are hit.

**Architecture:** Phase 0 is already in `mobile/src/lib/client/ad-banner.ts` (sticky banner + medium rectangle, both using Google test IDs). This plan covers (a) externalizing ad unit IDs so prod values come from a single config file, (b) Phase 2 interstitial scaffolded behind a compile-time flag, (c) ops items needed before submitting to Play (AdMob account, privacy policy hosting, Data Safety form), and (d) a weekly monitoring checklist.

**Tech Stack:**
- `@capacitor-community/admob` 6.x
- SvelteKit (mobile) — already in place
- GitHub Pages for the privacy policy
- AdMob Console, Play Console (operational)

**Spec:** `docs/superpowers/specs/2026-05-11-ad-strategy-design.md`

---

## File Structure

```
mobile/
├── src/lib/client/
│   ├── ad-config.ts             # NEW — single source of truth for ad unit IDs
│   ├── ad-banner.ts             # MODIFY — read IDs from ad-config; gate interstitial behind flag
│   └── SavedModal.svelte        # already in place
└── tests/unit/
    └── ad-config.test.ts        # NEW — unit test for dev/prod ID resolution

docs/
├── privacy-policy/
│   ├── index.html               # NEW — privacy policy text, hosted on GH Pages
│   └── README.md                # NEW — hosting + update notes
├── superpowers/
│   ├── specs/2026-05-11-ad-strategy-design.md   # already in place
│   └── plans/2026-05-11-ad-strategy.md          # this file
└── ops/
    ├── play-data-safety.md      # NEW — pre-filled answers for Play form
    └── weekly-review.md         # NEW — checklist + dashboard links
```

### File responsibilities

- **`ad-config.ts`** — exports `AD_UNITS = { banner, rect, interstitial }` resolved from `__DEV__` flag. Test units in dev, prod units in production builds. One file to edit when prod IDs are issued.
- **`ad-banner.ts`** — refactored to import from `ad-config.ts`. Adds a `maybeShowInterstitial()` function gated by `Phase2.INTERSTITIAL_ENABLED` constant (default `false`).
- **`docs/privacy-policy/index.html`** — single-page static HTML hosted at `https://velologiclabs.github.io/gpx-exporter-privacy/` (or equivalent). Linked from Play listing.
- **`docs/ops/play-data-safety.md`** — every checkbox/answer needed to fill the Play Data Safety questionnaire, so future-you doesn't re-derive it under pressure.
- **`docs/ops/weekly-review.md`** — operational checklist for the weekly retention + revenue review.

---

## Phase A — Code prep (refactor existing slots)

### Task 1: Extract ad unit IDs into `ad-config.ts`

**Files:**
- Create: `mobile/src/lib/client/ad-config.ts`
- Create: `mobile/tests/unit/ad-config.test.ts`
- Modify: `mobile/src/lib/client/ad-banner.ts`

- [ ] **Step 1.1: Write the failing test**

Create `mobile/tests/unit/ad-config.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('ad-config', () => {
  it('returns Google test IDs in dev mode', async () => {
    vi.stubGlobal('__DEV__', true);
    vi.resetModules();
    const { AD_UNITS } = await import('../../src/lib/client/ad-config');
    expect(AD_UNITS.banner).toBe('ca-app-pub-3940256099942544/6300978111');
    expect(AD_UNITS.rect).toBe('ca-app-pub-3940256099942544/6300978111');
    expect(AD_UNITS.interstitial).toBe('ca-app-pub-3940256099942544/1033173712');
  });

  it('returns production IDs when not in dev', async () => {
    vi.stubGlobal('__DEV__', false);
    vi.resetModules();
    const { AD_UNITS } = await import('../../src/lib/client/ad-config');
    // Until production IDs are configured (Task 7), prod resolves to test IDs
    // as a deliberate safety net. The Task 7 swap will update this assertion.
    expect(AD_UNITS.banner).toBe('ca-app-pub-3940256099942544/6300978111');
    expect(typeof AD_UNITS.interstitial).toBe('string');
  });
});
```

- [ ] **Step 1.2: Run — fail (module missing)**

```bash
cd /Users/jakubkunc/code/komoot-to-gpx/mobile
pnpm test ad-config 2>&1 | tail -5
```
Expected: FAIL — cannot find `src/lib/client/ad-config`.

- [ ] **Step 1.3: Create `mobile/src/lib/client/ad-config.ts`**

```typescript
declare const __DEV__: boolean;

const TEST_BANNER = 'ca-app-pub-3940256099942544/6300978111';
const TEST_INTERSTITIAL = 'ca-app-pub-3940256099942544/1033173712';

// Replace with real values from AdMob console once they're issued (Task 7).
// While these stay equal to the test IDs, production builds will simply show
// test ads, which is a safer default than empty/null until prod is configured.
const PROD_BANNER = TEST_BANNER;
const PROD_RECT = TEST_BANNER;
const PROD_INTERSTITIAL = TEST_INTERSTITIAL;

export const AD_UNITS = {
  banner: __DEV__ ? TEST_BANNER : PROD_BANNER,
  rect: __DEV__ ? TEST_BANNER : PROD_RECT,
  interstitial: __DEV__ ? TEST_INTERSTITIAL : PROD_INTERSTITIAL
};

// Phase 2 feature flag. Flip to `true` only after MAU >= 1,000 and the spec's
// "Phase 2 unlocked" checklist passes (see ad-strategy spec section 6.2).
export const PHASE2 = {
  INTERSTITIAL_ENABLED: false,
  /** Trigger an interstitial on every N-th successful GPX save. */
  INTERSTITIAL_EVERY_NTH_SAVE: 5,
  /** Hard rate limit between interstitials within a single app session (ms). */
  INTERSTITIAL_MIN_GAP_MS: 60_000
};
```

- [ ] **Step 1.4: Run — pass**

```bash
pnpm test ad-config 2>&1 | tail -5
```
Expected: 2 tests pass.

- [ ] **Step 1.5: Refactor `ad-banner.ts` to use `AD_UNITS`**

Replace the hard-coded `TEST_BANNER_ID`/`TEST_INTERSTITIAL_ID`/`TEST_RECT_ID` block at the top of `mobile/src/lib/client/ad-banner.ts` with:

```typescript
import { AD_UNITS } from './ad-config';
```

…and remove the six existing constants (`TEST_BANNER_ID`, `TEST_INTERSTITIAL_ID`, `TEST_RECT_ID`, `PROD_BANNER_ID`, `PROD_INTERSTITIAL_ID`, `PROD_RECT_ID`).

Then update the three references where they're used:

- In `showBanner()` change `adId: __DEV__ ? TEST_BANNER_ID : PROD_BANNER_ID` → `adId: AD_UNITS.banner`
- In `showModalRectangle()` change `adId: __DEV__ ? TEST_RECT_ID : PROD_RECT_ID` → `adId: AD_UNITS.rect`
- In `maybeShowInterstitial()` change `adId: __DEV__ ? TEST_INTERSTITIAL_ID : PROD_INTERSTITIAL_ID` → `adId: AD_UNITS.interstitial`

Remove the now-orphan `declare const __DEV__: boolean;` at the bottom (it's only needed in `ad-config.ts` now).

- [ ] **Step 1.6: Verify type-check + all tests**

```bash
pnpm check 2>&1 | tail -5
pnpm test 2>&1 | tail -8
```
Expected: 0 errors / 0 warnings; all unit tests pass (gpx 4 + komoot 5 + ad-config 2 = 11).

- [ ] **Step 1.7: Commit**

```bash
cd /Users/jakubkunc/code/komoot-to-gpx
git add mobile/src/lib/client/ad-config.ts mobile/src/lib/client/ad-banner.ts mobile/tests/unit/ad-config.test.ts
git commit -m "refactor(mobile): single ad-config module for unit IDs + Phase 2 flag"
```

---

### Task 2: Gate interstitial behind `PHASE2.INTERSTITIAL_ENABLED`

**Files:**
- Modify: `mobile/src/lib/client/ad-banner.ts`

- [ ] **Step 2.1: Update `maybeShowInterstitial()` to honor the flag**

Replace the existing `maybeShowInterstitial` function in `ad-banner.ts` with:

```typescript
import { AD_UNITS, PHASE2 } from './ad-config';

// ...other existing code stays...

export async function maybeShowInterstitial(): Promise<boolean> {
  if (!isAndroid()) return false;
  if (!PHASE2.INTERSTITIAL_ENABLED) return false;
  const now = Date.now();
  if (now - lastInterstitialAt < PHASE2.INTERSTITIAL_MIN_GAP_MS) return false;
  try {
    await initAds();
    await AdMob.prepareInterstitial({ adId: AD_UNITS.interstitial });
    await AdMob.showInterstitial();
    lastInterstitialAt = now;
    return true;
  } catch (e) {
    console.warn('AdMob interstitial failed:', e);
    return false;
  }
}
```

- [ ] **Step 2.2: Verify**

```bash
pnpm check 2>&1 | tail -5
pnpm test 2>&1 | tail -5
```
Expected: 0 errors; tests still pass.

- [ ] **Step 2.3: Commit**

```bash
cd /Users/jakubkunc/code/komoot-to-gpx
git add mobile/src/lib/client/ad-banner.ts
git commit -m "feat(mobile): gate interstitial behind PHASE2.INTERSTITIAL_ENABLED flag"
```

---

### Task 3: Hook the save counter (idle, ready for Phase 2)

**Files:**
- Modify: `mobile/src/routes/+page.svelte`
- Modify: `mobile/src/routes/tour/[id]/+page.svelte`

This wires the trigger so flipping `PHASE2.INTERSTITIAL_ENABLED = true` in Task 8 instantly enables the interstitial without UI changes. With the flag off, `maybeShowInterstitial()` is a no-op.

- [ ] **Step 3.1: Add save counter to `mobile/src/routes/+page.svelte`**

In the `<script>` block, near the other imports:

```typescript
  import { showBanner, hideBanner, maybeShowInterstitial } from '$lib/client/ad-banner';
  import { PHASE2 } from '$lib/client/ad-config';

  const SAVE_COUNT_KEY = 'gpx-exporter:save-count';
```

Then inside the existing `download(t, e)` function, immediately after `await saveGpxFile(filename, xml);` and before `savedModalFilename = filename;`, add:

```typescript
      const count = Number(localStorage.getItem(SAVE_COUNT_KEY) ?? '0') + 1;
      localStorage.setItem(SAVE_COUNT_KEY, String(count));
      if (count % PHASE2.INTERSTITIAL_EVERY_NTH_SAVE === 0) {
        void maybeShowInterstitial();
      }
```

- [ ] **Step 3.2: Same change in `mobile/src/routes/tour/[id]/+page.svelte`**

In the `<script>` block, near the other imports:

```typescript
  import { maybeShowInterstitial } from '$lib/client/ad-banner';
  import { PHASE2 } from '$lib/client/ad-config';

  const SAVE_COUNT_KEY = 'gpx-exporter:save-count';
```

Inside `downloadGpx()`, immediately after `await saveGpxFile(filename, xml);` and before `savedModalFilename = filename;`, add:

```typescript
      const count = Number(localStorage.getItem(SAVE_COUNT_KEY) ?? '0') + 1;
      localStorage.setItem(SAVE_COUNT_KEY, String(count));
      if (count % PHASE2.INTERSTITIAL_EVERY_NTH_SAVE === 0) {
        void maybeShowInterstitial();
      }
```

- [ ] **Step 3.3: Verify**

```bash
pnpm check 2>&1 | tail -5
pnpm test 2>&1 | tail -5
```
Expected: 0 errors; tests pass.

- [ ] **Step 3.4: Commit**

```bash
cd /Users/jakubkunc/code/komoot-to-gpx
git add mobile/src/routes/+page.svelte mobile/src/routes/tour/[id]/+page.svelte
git commit -m "feat(mobile): wire save counter to gated interstitial (idle behind flag)"
```

---

## Phase B — Pre-launch ops (operational, not code)

### Task 4: Create AdMob production account + app + ad units

This is a manual, browser-only task. The output is **three production ad unit IDs** that will be pasted into `ad-config.ts` in Task 7.

- [ ] **Step 4.1: Sign up for AdMob**

Open https://admob.google.com and sign up with the **same Google account** that owns the Play Console developer account. Verify country/timezone — these can't be changed after signup.

- [ ] **Step 4.2: Add the app**

In AdMob → Apps → Add app:

- Platform: **Android**
- Already published on a store: **No** (it isn't yet)
- App name: **Export GPX for Komoot**
- Package name: `com.velologiclabs.gpxexporter`

AdMob assigns an **App ID** in the form `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`. Copy it.

- [ ] **Step 4.3: Update Android manifest with the real App ID**

Edit `mobile/android/app/src/main/AndroidManifest.xml`. Find the `meta-data` element with `android.name="com.google.android.gms.ads.APPLICATION_ID"` and replace the value:

```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY" />
```

(swap the placeholder for the value from Step 4.2).

- [ ] **Step 4.4: Create three ad units in AdMob console**

In AdMob → Apps → (your app) → Ad units → Add ad unit. Create three units, one at a time:

| Unit name | Format | Notes |
|---|---|---|
| `tour-list-banner` | Banner | Adaptive size — leave defaults |
| `saved-modal-rect` | Banner | 300×250 Medium Rectangle |
| `post-save-interstitial` | Interstitial | Leave defaults |

For each, AdMob returns a unit ID in the form `ca-app-pub-XXXXXXXXXXXXXXXX/NNNNNNNNNN`. Copy all three into a temporary note — they go into the code in Task 7.

- [ ] **Step 4.5: Commit the manifest change**

```bash
cd /Users/jakubkunc/code/komoot-to-gpx
git add mobile/android/app/src/main/AndroidManifest.xml
git commit -m "chore(mobile): swap test AdMob app id for production"
```

---

### Task 5: Privacy policy on GitHub Pages

**Files:**
- Create: `docs/privacy-policy/index.html`
- Create: `docs/privacy-policy/README.md`

- [ ] **Step 5.1: Create `docs/privacy-policy/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Privacy Policy — Export GPX for Komoot</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;
      max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a1a1a; }
    h1 { font-size: 1.8rem; letter-spacing: -0.02em; }
    h2 { margin-top: 2rem; font-size: 1.2rem; }
    code { background: #f4f4f5; padding: 0.05rem 0.3rem; border-radius: 3px; font-size: 0.9em; }
    a { color: #2563eb; }
    .meta { color: #666; font-size: 0.85rem; }
  </style>
</head>
<body>
  <h1>Privacy Policy — Export GPX for Komoot</h1>
  <p class="meta">Last updated: 2026-05-11 · Publisher: VeloLogic Labs · Contact: contact@velologic-labs.com</p>

  <h2>1. What we collect</h2>
  <p>
    The app itself collects no personal information. It does not have a backend
    server. All Komoot tour data fetched while you use the app stays on your
    device and is never transmitted to us.
  </p>
  <p>
    Google AdMob, which serves ads inside the app, collects the
    <strong>Advertising ID</strong>, your <strong>IP address</strong>, and basic
    device / ad performance signals on our behalf, in line with Google's
    <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">
      Privacy &amp; Terms
    </a>.
  </p>

  <h2>2. What we don't collect</h2>
  <ul>
    <li>Your name, email, or Komoot password (the password is entered only on Komoot's own login page inside an in-app browser).</li>
    <li>Your GPS location.</li>
    <li>Your contacts, photos, or any device storage outside files you explicitly export.</li>
    <li>Analytics events sent to us (no Firebase Analytics, no PostHog, no custom tracking).</li>
  </ul>

  <h2>3. Where your Komoot session lives</h2>
  <p>
    After you sign in, the app keeps a Komoot session token on your device,
    encrypted using Android Keystore via Capacitor Preferences. Signing out
    or clearing the app's data removes it.
  </p>

  <h2>4. Network connections</h2>
  <p>The app communicates with the following endpoints, and only these:</p>
  <ul>
    <li><code>api.komoot.de</code> — fetching your tours and GPX coordinates.</li>
    <li><code>www.komoot.com</code> — the in-app sign-in page.</li>
    <li><code>tile.openstreetmap.org</code> — map tiles for the tour preview.</li>
    <li>AdMob ad-serving domains operated by Google (<code>googleads.g.doubleclick.net</code> and related).</li>
  </ul>

  <h2>5. Consent (EEA / UK / Switzerland)</h2>
  <p>
    On first launch in covered regions the app shows Google's consent dialog
    (UMP). If you decline personalized advertising, AdMob serves only
    non-personalized ads.
  </p>
  <p>
    To reset consent, go to Android Settings → Apps → Export GPX for Komoot
    → Storage → Clear storage. The consent dialog will appear again on the next
    launch.
  </p>

  <h2>6. Children</h2>
  <p>The app is not directed at children under 13. We do not knowingly collect data from them.</p>

  <h2>7. Changes to this policy</h2>
  <p>
    Material changes will be reflected here with an updated "Last updated"
    date. The link to this page is included in the Play Store listing.
  </p>

  <h2>8. Contact</h2>
  <p>
    Questions or removal requests: <a href="mailto:contact@velologic-labs.com">contact@velologic-labs.com</a>.
  </p>
</body>
</html>
```

- [ ] **Step 5.2: Create `docs/privacy-policy/README.md`**

```markdown
# Privacy policy hosting

This folder is published to GitHub Pages so it can be linked from the Play Store
listing of **Export GPX for Komoot**.

## Setup (one-off)

1. Push this folder to the repo's `main` branch.
2. On GitHub → Settings → Pages, set:
   - **Source:** Deploy from a branch
   - **Branch:** `main`
   - **Folder:** `/docs`
3. After ~1 minute the policy is live at
   `https://<owner>.github.io/komoot-to-gpx/privacy-policy/`.

## Updating the policy

Edit `index.html`. Bump the "Last updated" date at the top. Commit + push.
GitHub Pages republishes within a minute.
```

- [ ] **Step 5.3: Commit**

```bash
cd /Users/jakubkunc/code/komoot-to-gpx
git add docs/privacy-policy/
git commit -m "docs: privacy policy HTML for GitHub Pages hosting"
```

- [ ] **Step 5.4: Enable GitHub Pages (manual, one-off)**

Push to GitHub if not yet (`git push origin main`). Then in the GitHub UI:

- Settings → Pages → Source: **Deploy from a branch**
- Branch: `main` · Folder: **/docs**
- Save.

Within ~1 minute, verify the page is live by opening
`https://<repo-owner>.github.io/komoot-to-gpx/privacy-policy/` in a browser.
Copy that URL — it goes into the Play listing and the Data Safety form.

---

### Task 6: Pre-fill Play Data Safety answers

**Files:**
- Create: `docs/ops/play-data-safety.md`

- [ ] **Step 6.1: Create `docs/ops/play-data-safety.md`**

```markdown
# Play Data Safety form — answers cheat sheet

Use these exact answers when filling out **Play Console → Policy → App content
→ Data safety**. Source of truth: `docs/superpowers/specs/2026-05-11-ad-strategy-design.md`
sections 4.1 and 4.2.

## 1. Data collection and security

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** (via AdMob) |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS only) |
| Do you provide a way for users to request that their data is deleted? | **Yes** (uninstall + sign-out) |

## 2. Data types — declare these and only these

### Location
- Approximate location: **Collected, not shared with us; processed by Google AdMob.**
  - Reason: Advertising or marketing
  - Optional/required: Optional (UMP consent declines result in non-personalized ads only)

### App activity
- App interactions, in-app search history, installed apps, other user-generated content,
  other actions: **None** (we don't track app activity ourselves; AdMob may collect
  page views for ad attribution).

### Device or other identifiers
- Device or other IDs (incl. Advertising ID): **Collected and shared with Google AdMob.**
  - Reason: Advertising or marketing
  - Optional/required: Optional

### Everything else
- Personal info (name, email address, user IDs, address, phone number, race/ethnicity, etc.): **None**
- Financial info: **None**
- Health & fitness: **None** (we never read your GPS or workouts; we relay
  Komoot's API responses to you locally)
- Messages, photos and videos, audio files, files and docs: **None**
- Calendar, contacts: **None**
- Web browsing: **None**

## 3. Security practices

- **Data is encrypted in transit:** Yes
- **You can request that data is deleted:** Yes — uninstall the app and sign out
  of your Komoot account in the app, or contact `contact@velologic-labs.com`
- **Committed to Play Families Policy:** N/A (not targeted at families)

## 4. Privacy policy URL

`https://<owner>.github.io/komoot-to-gpx/privacy-policy/`
(replace `<owner>` with the GitHub repo owner once Pages is live — see Task 5)
```

- [ ] **Step 6.2: Commit**

```bash
cd /Users/jakubkunc/code/komoot-to-gpx
git add docs/ops/play-data-safety.md
git commit -m "docs: pre-filled Play Data Safety answers"
```

---

### Task 7: Swap production AdMob unit IDs into the code

**Files:**
- Modify: `mobile/src/lib/client/ad-config.ts`

- [ ] **Step 7.1: Replace placeholder constants with real values**

In `mobile/src/lib/client/ad-config.ts`, replace the three `PROD_*` constants:

```typescript
const PROD_BANNER = 'ca-app-pub-XXXXXXXXXXXXXXXX/AAAAAAAAAA';        // from Task 4.4 row 1
const PROD_RECT = 'ca-app-pub-XXXXXXXXXXXXXXXX/BBBBBBBBBB';          // from Task 4.4 row 2
const PROD_INTERSTITIAL = 'ca-app-pub-XXXXXXXXXXXXXXXX/CCCCCCCCCC'; // from Task 4.4 row 3
```

Paste the actual values copied from AdMob in Task 4.4. Do not commit the strings
`AAAAAAAAAA` / `BBBBBBBBBB` / `CCCCCCCCCC` — they are placeholders only for this plan.

- [ ] **Step 7.2: Update Task 1 test for prod IDs**

Edit `mobile/tests/unit/ad-config.test.ts`. Replace the second test ("returns production IDs when not in dev") to assert against the new prod values (whatever was pasted in Step 7.1). Example shape:

```typescript
  it('returns production IDs when not in dev', async () => {
    vi.stubGlobal('__DEV__', false);
    vi.resetModules();
    const { AD_UNITS } = await import('../../src/lib/client/ad-config');
    expect(AD_UNITS.banner).toMatch(/^ca-app-pub-\d+\/\d+$/);
    expect(AD_UNITS.banner).not.toBe('ca-app-pub-3940256099942544/6300978111');
    expect(AD_UNITS.rect).toMatch(/^ca-app-pub-\d+\/\d+$/);
    expect(AD_UNITS.interstitial).toMatch(/^ca-app-pub-\d+\/\d+$/);
  });
```

The regex form keeps real publisher IDs out of the test file (slightly cleaner for OSS visibility).

- [ ] **Step 7.3: Verify**

```bash
cd /Users/jakubkunc/code/komoot-to-gpx/mobile
pnpm test ad-config 2>&1 | tail -5
```
Expected: both tests pass.

- [ ] **Step 7.4: Production build sanity**

```bash
export JAVA_HOME="/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
cd /Users/jakubkunc/code/komoot-to-gpx/mobile
pnpm build --mode production 2>&1 | tail -5
```
Expected: `✔ done`. SPA built with `__DEV__ === false`, so `AD_UNITS` will resolve to the new prod values at runtime.

- [ ] **Step 7.5: Commit**

```bash
cd /Users/jakubkunc/code/komoot-to-gpx
git add mobile/src/lib/client/ad-config.ts mobile/tests/unit/ad-config.test.ts
git commit -m "chore(mobile): wire production AdMob ad unit IDs"
```

---

## Phase C — Monitoring setup (operational)

### Task 8: Weekly review checklist

**Files:**
- Create: `docs/ops/weekly-review.md`

- [ ] **Step 8.1: Create `docs/ops/weekly-review.md`**

```markdown
# Weekly ad strategy review

Run every Monday morning (~10 minutes). Source of truth for triggers:
`docs/superpowers/specs/2026-05-11-ad-strategy-design.md` §6.2.

## Tabs to open

1. **Play Console → Vitals → Reach and devices → Users**
   - Note: DAU, MAU, day-1 / day-7 / day-30 retention
2. **Play Console → Ratings & reviews**
   - Filter: last 7 days, sort by lowest rating
   - Read every 1–2 ★. Search the page text for "ad", "ads", "advert".
3. **AdMob Console → Reports → All ad units**
   - Range: last 7 days
   - Note per unit: impressions, eCPM, revenue
4. **Play Console → Vitals → ANR & crash rate**
   - Threshold for bad week: ANR > 0.47%, crash rate > 1.09% (Play's "bad behaviour" thresholds)

## Decision matrix

| Observation | Action |
|---|---|
| Any 1–2 ★ review mentioning "ads" / "advert" | Reply within 24h, log it. If 2 in one week → consider softening (reduce frequency, smaller rect) |
| Day-7 retention dropped > 3 pp w/w | Pause any new ad slots, investigate; check release notes for recent changes |
| MAU crossed 1,000 for the first time | Phase 2 unlocked. Schedule the interstitial pilot rollout (flip `PHASE2.INTERSTITIAL_ENABLED` to `true`) |
| MAU crossed 5,000 for the first time | Phase 3 unlocked. Plan Remove Ads IAP |
| Total revenue < $5 / month for 3 months running | Re-evaluate: either enable interstitial despite UX, or drop ads and ask for donations |
| Komoot DMCA / policy email | Pull app from Play immediately; everything else is moot |

## Where to log

Append a one-line entry to `docs/ops/weekly-review-log.md` (create on first run):

`2026-05-18 | DAU 42 | MAU 180 | rev $0.31 | 0 ad-related reviews | no action`
```

- [ ] **Step 8.2: Commit**

```bash
cd /Users/jakubkunc/code/komoot-to-gpx
git add docs/ops/weekly-review.md
git commit -m "docs: weekly ad strategy review checklist"
```

---

## Phase D — Final verification

### Task 9: Pre-submission audit

This is a checklist for the final state before pushing the AAB to Play.

- [ ] **Step 9.1: Verify all unit tests pass**

```bash
cd /Users/jakubkunc/code/komoot-to-gpx/mobile
pnpm check 2>&1 | tail -3
pnpm test 2>&1 | tail -5
```
Expected: 0 errors / 0 warnings; 11 unit tests pass (gpx 4 + komoot 5 + ad-config 2).

- [ ] **Step 9.2: Verify ad-config has real production IDs (not test placeholders)**

```bash
grep -n "PROD_" /Users/jakubkunc/code/komoot-to-gpx/mobile/src/lib/client/ad-config.ts | head -10
```
Expected: all three `PROD_*` constants contain `ca-app-pub-XXXXXXXX/...` real values, not `3940256099942544` (the Google test publisher ID).

- [ ] **Step 9.3: Verify AndroidManifest contains real App ID**

```bash
grep -A1 "APPLICATION_ID" /Users/jakubkunc/code/komoot-to-gpx/mobile/android/app/src/main/AndroidManifest.xml
```
Expected: the `android:value` does **not** contain `3940256099942544` (the Google test app ID).

- [ ] **Step 9.4: Verify privacy policy is reachable**

Open `https://<owner>.github.io/komoot-to-gpx/privacy-policy/` in a browser.
Expected: 200, policy renders.

- [ ] **Step 9.5: Production AAB build**

```bash
cd /Users/jakubkunc/code/komoot-to-gpx/mobile
pnpm android:bundle 2>&1 | tail -5
ls -lh android/app/build/outputs/bundle/release/app-release.aab
```
Expected: `BUILD SUCCESSFUL`. AAB file exists, ~8-12 MB.

- [ ] **Step 9.6: Confirmation commit**

```bash
cd /Users/jakubkunc/code/komoot-to-gpx
git commit --allow-empty -m "chore: ad strategy + ops docs ready for Play Store submission"
```

After this, the actual Play Store upload (Play Console UI: app listing, screenshots, AAB upload, Data Safety form using `docs/ops/play-data-safety.md`, privacy policy URL from Task 5) is the manual final step — not part of this code plan.

---

## Self-Review

**1. Spec coverage**

| Spec section | Task(s) |
|---|---|
| §1 Strategic decisions (retention #1, no IAP, AdMob-only analytics) | Encoded as the implicit constraints throughout; Task 1 keeps AD_UNITS as the only knob, Task 2 keeps interstitial off by default |
| §2.1 Sticky banner | Already wired; Task 1 refactors source of unit ID |
| §2.2 Medium Rectangle | Already wired; Task 1 refactors source of unit ID |
| §2.3 Slot interaction rules (single banner at a time) | Already enforced in existing `ad-banner.ts` (preserved in Task 1 refactor) |
| §3 Excluded formats | Out of scope by omission; only the three v1 unit slots in `AD_UNITS` |
| §4.1 Privacy policy text | Task 5 |
| §4.2 Play Data Safety answers | Task 6 |
| §5 UMP consent | Already implemented in `initAds()` — preserved through refactor |
| §6.1 Weekly review dashboards | Task 8 |
| §6.2 Decision triggers | Task 8 (matrix), Task 2 (Phase 2 readiness) |
| §7 Phase 1 prod cutover | Tasks 4 + 7 (AdMob acct/IDs), Task 5 (privacy policy), Task 6 (Data Safety) |
| §7 Phase 2 interstitial pilot | Task 2 (gate) + Task 3 (counter) — flip `PHASE2.INTERSTITIAL_ENABLED` to enable |
| §7 Phase 3 Remove Ads IAP | Deferred (separate spec/plan when MAU ≥ 5k) |
| §7 Phase 4 rewarded ad | Deferred (depends on bulk export feature) |
| §8 Out of scope | Honored — no A/B testing infra, no custom analytics |

**2. Placeholder scan**

- `ca-app-pub-XXXXXXXXXXXXXXXX/AAAAAAAAAA` etc. in Task 7.1 — intentional placeholders, replaced at execution time with real values from AdMob console. Marked clearly as such with comments. Acceptable; these are operational substitutions, not code TODOs.
- `<owner>` in privacy policy URLs — replaced at Task 5.4 once the GitHub repo owner is known. Acceptable.
- No "TBD", no "implement later", no orphan "similar to Task N".

**3. Type consistency**

- `AD_UNITS` shape `{ banner: string; rect: string; interstitial: string }` — defined in Task 1.3, consumed identically in Task 1.5 (`AD_UNITS.banner`), Task 2.1 (`AD_UNITS.interstitial`). ✓
- `PHASE2` shape `{ INTERSTITIAL_ENABLED: boolean; INTERSTITIAL_EVERY_NTH_SAVE: number; INTERSTITIAL_MIN_GAP_MS: number }` — defined Task 1.3, used in Task 2.1 (flag + ms) and Task 3.1/3.2 (counter modulo). ✓
- `SAVE_COUNT_KEY` constant `'gpx-exporter:save-count'` — same string in Task 3.1 and Task 3.2 (both routes share counter). ✓
- `maybeShowInterstitial(): Promise<boolean>` — same signature defined Task 2.1, called Task 3.1 and 3.2. ✓

Plan ready.
