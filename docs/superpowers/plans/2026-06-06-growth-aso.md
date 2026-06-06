# Growth: ASO + Reviews + Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow organic installs via sanitized + localized Play listings, an in-app review prompt, an SEO landing page, and removal of a deprecated edge-to-edge API.

**Architecture:** Listing copy lives as paste-ready docs in `docs/ops/`. The review prompt is a pure decision function (`review.ts`, unit-tested) plus a fire-and-forget call to the Play In-App Review API via `@capacitor-community/in-app-review`. The landing page is framework-free static HTML in `web-landing/`, uploaded over FTP by the user. The status-bar fix replaces runtime `window.statusBarColor` with a dedicated activity theme.

**Tech Stack:** Svelte 5 + Capacitor 6 (mobile), Vitest, plain HTML/CSS (landing), Android themes (styles.xml).

**Spec:** `docs/superpowers/specs/2026-06-06-growth-aso-design.md`

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `docs/ops/play-store-listing.md` | modify | sanitized EN copy (no Premium mention, ASO keywords) |
| `docs/ops/play-store-listing-de.md` … `-pl.md` | create | per-language paste-ready listing copy |
| `mobile/src/lib/client/review.ts` | create | `SAVE_COUNT_KEY`, `shouldRequestReview()`, `maybeRequestReview()` |
| `mobile/tests/unit/review.test.ts` | create | unit tests for the decision function |
| `mobile/src/routes/+page.svelte` | modify | import key from review.ts, call `maybeRequestReview` on modal close |
| `mobile/src/routes/tour/[id]/+page.svelte` | modify | same |
| `mobile/android/app/src/main/res/values/styles.xml` | modify | `AppTheme.Login` theme (black window bg, light icons) |
| `mobile/android/app/src/main/AndroidManifest.xml` | modify | assign theme to LoginActivity |
| `mobile/android/app/src/main/java/.../LoginActivity.kt` | modify | drop deprecated `statusBarColor` code |
| `web-landing/index.html`, `de/index.html`, `style.css`, `robots.txt`, `sitemap.xml` | create | SEO landing page |
| `mobile/CHANGELOG.md` | modify | user-facing entries (review prompt) |

---

### Task 1: Sanitize the English listing

**Files:**
- Modify: `docs/ops/play-store-listing.md`

- [ ] **Step 1: Replace the short description block** (the fenced block under `## Short description`):

```
Export Komoot tours as GPX — for Garmin, Wahoo, any bike computer or GPS watch.
```

(79 chars.)

- [ ] **Step 2: Replace the full description** fenced block under `## Full description` with:

```
Export GPX for Komoot lets you download your own Komoot tours as standard GPX files — including private ones — so you can load them onto your GPS watch, bike computer, or any navigation app that imports GPX.

You sign in to Komoot on their own login page (we never see your password). The app then lists every tour from your account, shows a real-map preview of each route, and saves any tour to your phone as a GPX file with one tap. You can also share a tour from the Komoot app straight into this one — it opens here, ready to export.

WHAT YOU CAN DO
• Browse every recorded ride and every planned route on your account.
• Filter the list to show only Completed or only Planned tours.
• See a real-map preview of each route before you export.
• Share a tour from the Komoot app — it opens here, ready to save (Share → Export GPX).
• Save a tour as a standard .gpx file anywhere on your phone — Downloads, Drive, Dropbox.
• Load the GPX file into Garmin Connect, Wahoo, Hammerhead, Bryton, Coros, Suunto, Apple Watch, OsmAnd, Locus Map, Gaia, or any other app that imports GPX.

YOUR ROUTES, ANY DEVICE
A route you planned or recorded is yours. Exporting it as a GPX file means you can navigate with any device you like — a Garmin or Wahoo bike computer, a sports watch, or another mapping app — while you keep planning in Komoot.

PRIVACY
The app has no backend server. Your Komoot login happens in an in-app browser on komoot.com — we never see your email or password. Tour data flows directly between your phone and Komoot's servers; we don't proxy or store it.

ADS
The app is free and shows a small banner ad. In the EEA the app asks for consent before serving personalized ads (you can decline and still use everything).

NOT AFFILIATED WITH KOMOOT
This is a third-party tool. "Komoot" is a registered trademark of komoot GmbH. We are not affiliated with or endorsed by komoot GmbH. The app uses your own account to retrieve your own data.

SUPPORT
Found a bug? Tour not exporting? Email contact@velologic-labs.eu — usually a same-day reply.

Privacy policy: https://kubakunc.github.io/komoot-to-gpx/privacy-policy/
```

- [ ] **Step 3: Fix remaining placeholders in the file** — replace every `https://<owner>.github.io/komoot-to-gpx/privacy-policy/` with `https://kubakunc.github.io/komoot-to-gpx/privacy-policy/` and the Website bullet with `https://velologic-labs.eu`.

- [ ] **Step 4: Commit**

```bash
git add docs/ops/play-store-listing.md
git commit -m "docs: sanitize EN Play listing — drop Premium mention, add ASO keywords"
```

### Task 2: German listing (the template for all locales)

**Files:**
- Create: `docs/ops/play-store-listing-de.md`

- [ ] **Step 1: Create the file** with this content:

````markdown
# Play Store listing — Deutsch (de-DE)

Play Console → Main store listing → **Add language → German (Germany)**.
Titel bleibt englisch (Markenname enthält bereits "GPX" + "Komoot").

## Short description (≤ 80 Zeichen)

```
Komoot Touren als GPX exportieren — für Garmin, Wahoo, Radcomputer & GPS-Uhren.
```

## Full description (≤ 4000 Zeichen)

```
Mit Export GPX for Komoot lädst du deine eigenen Komoot Touren als GPX-Dateien herunter — auch private — und nutzt sie auf deiner GPS-Uhr, deinem Radcomputer oder in jeder App, die GPX-Dateien importiert.

Du meldest dich auf der Komoot-Login-Seite an (wir sehen dein Passwort nie). Danach zeigt die App alle Touren deines Kontos mit einer echten Kartenvorschau, und du speicherst jede Tour mit einem Tipp als GPX-Datei. Du kannst eine Tour auch direkt aus der Komoot-App teilen — sie öffnet sich hier, bereit zum Export.

WAS DU MACHEN KANNST
• Alle aufgezeichneten und geplanten Touren deines Kontos durchsuchen.
• Liste filtern: nur Gemachte oder nur Geplante Touren.
• Echte Kartenvorschau jeder Route vor dem Export.
• Tour aus der Komoot-App teilen (Teilen → Export GPX) — sie öffnet sich hier sofort.
• Tour als .gpx-Datei überall auf dem Handy speichern — Downloads, Drive, Dropbox.
• GPX-Datei in Garmin Connect, Wahoo, Hammerhead, Bryton, Coros, Suunto, OsmAnd, Locus Map oder jede andere GPX-App laden.

DEINE ROUTEN, JEDES GERÄT
Eine Route, die du geplant oder aufgezeichnet hast, gehört dir. Als GPX-Datei exportiert kannst du mit jedem Gerät navigieren — Garmin oder Wahoo Radcomputer, Sportuhr oder eine andere Karten-App — während du weiter mit Komoot planst.

DATENSCHUTZ
Die App hat keinen eigenen Server. Dein Komoot-Login passiert in einem In-App-Browser auf komoot.com — wir sehen E-Mail und Passwort nie. Tourdaten fließen direkt zwischen deinem Handy und den Komoot-Servern.

WERBUNG
Die App ist kostenlos und zeigt ein kleines Werbebanner. Im EWR fragt die App vor personalisierter Werbung nach deiner Einwilligung.

KEINE VERBINDUNG ZU KOMOOT
Dies ist ein Drittanbieter-Tool. "Komoot" ist eine eingetragene Marke der komoot GmbH. Wir sind nicht mit der komoot GmbH verbunden. Die App nutzt dein eigenes Konto für deine eigenen Daten.

SUPPORT
Fehler gefunden? Tour lässt sich nicht exportieren? Schreib an contact@velologic-labs.eu — Antwort meist am selben Tag.

Datenschutzerklärung: https://kubakunc.github.io/komoot-to-gpx/privacy-policy/
```

## Suchbegriffe (zur Orientierung, nicht einfügbar)

komoot gpx export, komoot tour herunterladen, komoot gpx datei, komoot garmin, komoot wahoo, gpx download
````

- [ ] **Step 2: Commit**

```bash
git add docs/ops/play-store-listing-de.md
git commit -m "docs: German Play listing copy (ASO keywords for de-DE)"
```

### Task 3: NL / FR / IT / ES / PL listings

**Files:**
- Create: `docs/ops/play-store-listing-nl.md`, `-fr.md`, `-it.md`, `-es.md`, `-pl.md`

- [ ] **Step 1: Create the five files**, each following the exact structure of the German file from Task 2 (header noting the Play Console language to add, Short description block, Full description block, keyword list). Translate the **English full description from Task 1** (not the German) into each language, weaving in these locale search phrases naturally:

Short descriptions (use verbatim; each ≤ 80 chars):

| File | Play language | Short description |
|---|---|---|
| `-nl.md` | Dutch (nl-NL) | `Komoot tochten exporteren als GPX — voor Garmin, Wahoo en elke fietscomputer.` |
| `-fr.md` | French (fr-FR) | `Exportez vos itinéraires Komoot en GPX — Garmin, Wahoo, compteurs vélo, montres.` |
| `-it.md` | Italian (it-IT) | `Esporta i tour Komoot in GPX — per Garmin, Wahoo, ciclocomputer e orologi GPS.` |
| `-es.md` | Spanish (es-ES) | `Exporta tus rutas de Komoot a GPX — para Garmin, Wahoo, ciclocomputadores y relojes.` |
| `-pl.md` | Polish (pl-PL) | `Eksportuj trasy z Komoot do GPX — na Garmin, Wahoo, licznik rowerowy i zegarek.` |

Keyword lists per locale (for the "Suchbegriffe"-style footer section):
- nl: `komoot gpx exporteren, komoot tocht downloaden, komoot garmin, gpx bestand`
- fr: `komoot gpx export, télécharger itinéraire komoot, komoot garmin, fichier gpx`
- it: `komoot gpx esportare, scaricare tour komoot, komoot garmin, file gpx`
- es: `komoot gpx exportar, descargar ruta komoot, komoot garmin, archivo gpx`
- pl: `komoot gpx eksport, pobierz trasę komoot, komoot garmin, plik gpx`

- [ ] **Step 2: Verify short descriptions are ≤ 80 chars**

Run: `for f in docs/ops/play-store-listing-{nl,fr,it,es,pl}.md; do awk '/## Short/,/^```$/' $f | sed -n '3p' | wc -c; done`
Expected: every number ≤ 81 (80 chars + newline).

- [ ] **Step 3: Commit**

```bash
git add docs/ops/play-store-listing-{nl,fr,it,es,pl}.md
git commit -m "docs: NL/FR/IT/ES/PL Play listing copy for localized ASO"
```

### Task 4: Review decision function (TDD)

**Files:**
- Create: `mobile/src/lib/client/review.ts`
- Test: `mobile/tests/unit/review.test.ts`

- [ ] **Step 1: Write the failing test** (`mobile/tests/unit/review.test.ts`):

```typescript
import { describe, it, expect } from 'vitest';
import { shouldRequestReview } from '../../src/lib/client/review';

describe('shouldRequestReview', () => {
  it('does not trigger on the first save', () => {
    expect(shouldRequestReview(1)).toBe(false);
  });

  it('triggers on the second save', () => {
    expect(shouldRequestReview(2)).toBe(true);
  });

  it('then triggers every 5 saves (7, 12, 17...)', () => {
    expect(shouldRequestReview(7)).toBe(true);
    expect(shouldRequestReview(12)).toBe(true);
    expect(shouldRequestReview(17)).toBe(true);
  });

  it('stays quiet between trigger points', () => {
    for (const n of [3, 4, 5, 6, 8, 9, 10, 11, 13]) {
      expect(shouldRequestReview(n)).toBe(false);
    }
  });

  it('handles zero and negative defensively', () => {
    expect(shouldRequestReview(0)).toBe(false);
    expect(shouldRequestReview(-3)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && pnpm vitest run tests/unit/review.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/client/review'`

- [ ] **Step 3: Implement** (`mobile/src/lib/client/review.ts`):

```typescript
import { Capacitor } from '@capacitor/core';

/** Shared with the save flows in both tour pages. */
export const SAVE_COUNT_KEY = 'gpx-exporter:save-count';

/**
 * Ask for a Play Store rating on the 2nd successful save, then every 5
 * saves after that (7, 12, ...). Google throttles the actual dialog, so
 * repeated requests are free — most silently no-op.
 */
export function shouldRequestReview(saveCount: number): boolean {
  if (saveCount === 2) return true;
  return saveCount > 2 && (saveCount - 2) % 5 === 0;
}

/** Fire-and-forget: reads the save counter and asks Play for the dialog. */
export async function maybeRequestReview(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  const count = Number(localStorage.getItem(SAVE_COUNT_KEY) ?? '0');
  if (!shouldRequestReview(count)) return;
  try {
    const { InAppReview } = await import('@capacitor-community/in-app-review');
    await InAppReview.requestReview();
  } catch (e) {
    console.warn('In-app review failed:', e);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && pnpm vitest run tests/unit/review.test.ts`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add mobile/src/lib/client/review.ts mobile/tests/unit/review.test.ts
git commit -m "feat(mobile): review-prompt decision function (2nd save, then every 5)"
```

### Task 5: Install plugin + wire into both save flows

**Files:**
- Modify: `mobile/src/routes/+page.svelte` (lines ~18, ~114-119, ~226-228)
- Modify: `mobile/src/routes/tour/[id]/+page.svelte` (lines ~13, ~76-81, ~144-146)
- Modify: `mobile/CHANGELOG.md`

- [ ] **Step 1: Install the plugin**

```bash
cd mobile && pnpm add @capacitor-community/in-app-review@6.0.0 && npx cap sync android
```

- [ ] **Step 2: In `mobile/src/routes/+page.svelte`** — add the import, delete the local key, and call on modal close:

```typescript
// add to imports:
import { SAVE_COUNT_KEY, maybeRequestReview } from '$lib/client/review';
// DELETE the line: const SAVE_COUNT_KEY = 'gpx-exporter:save-count';
```

Replace the SavedModal mount at the bottom:

```svelte
{#if savedModalFilename}
  <SavedModal
    filename={savedModalFilename}
    onClose={() => {
      savedModalFilename = null;
      void maybeRequestReview();
    }}
  />
{/if}
```

- [ ] **Step 3: In `mobile/src/routes/tour/[id]/+page.svelte`** — make the identical three changes (import from `$lib/client/review`, delete local `SAVE_COUNT_KEY` const, same onClose block).

- [ ] **Step 4: Run all tests + build**

Run: `cd mobile && pnpm run test && pnpm run build && npx cap sync android`
Expected: 41 tests passed (36 + 5 new), build OK.

- [ ] **Step 5: Add changelog entry** under `## [Unreleased]` (create the section above `## [1.0.4]` if missing) in `mobile/CHANGELOG.md`:

```markdown
## [Unreleased]

### Added
- After a successful export the app may ask for a quick Play Store rating
  (Google's standard in-app dialog, at most occasionally).
```

- [ ] **Step 6: Commit**

```bash
git add mobile/package.json mobile/pnpm-lock.yaml mobile/src/routes/+page.svelte "mobile/src/routes/tour/[id]/+page.svelte" mobile/CHANGELOG.md mobile/android
git commit -m "feat(mobile): in-app review prompt after successful exports"
```

### Task 6: Replace deprecated statusBarColor with a Login theme

**Files:**
- Modify: `mobile/android/app/src/main/res/values/styles.xml`
- Modify: `mobile/android/app/src/main/AndroidManifest.xml:37-41`
- Modify: `mobile/android/app/src/main/java/com/velologiclabs/gpxexporter/LoginActivity.kt:34-43`

- [ ] **Step 1: Add the theme** to `styles.xml` (before `</resources>`):

```xml
    <style name="AppTheme.Login" parent="Theme.AppCompat.NoActionBar">
        <item name="android:windowBackground">#0A0A0A</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowLightNavigationBar">false</item>
    </style>
```

- [ ] **Step 2: Assign it in the manifest** — add to the LoginActivity element:

```xml
        <activity
            android:name=".LoginActivity"
            android:exported="false"
            android:theme="@style/AppTheme.Login"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
            android:label="Sign in to Komoot" />
```

- [ ] **Step 3: Delete the runtime code** in `LoginActivity.kt` `onCreate` — remove these lines:

```kotlin
        // Black status bar matching the info banner below it; white icons.
        window.statusBarColor = 0xFF0A0A0A.toInt()
        androidx.core.view.WindowCompat
            .getInsetsController(window, window.decorView)
            .isAppearanceLightStatusBars = false
```

(The layout keeps `android:fitsSystemWindows="true"`; the black now comes from `windowBackground`.)

- [ ] **Step 4: Verify on the emulator**

```bash
cd mobile/android && ./gradlew installDebug -q
adb shell am start -n com.velologiclabs.gpxexporter/.MainActivity
# tap "Sign in with Komoot", then:
adb exec-out screencap -p > /tmp/login-theme.png
```

Expected: black bar behind status icons (white clock/battery), black note banner below, no regression.

- [ ] **Step 5: Commit**

```bash
git add mobile/android/app/src/main/res/values/styles.xml mobile/android/app/src/main/AndroidManifest.xml mobile/android/app/src/main/java/com/velologiclabs/gpxexporter/LoginActivity.kt
git commit -m "fix(mobile): replace deprecated statusBarColor with Login theme"
```

### Task 7: Landing page (static, FTP)

**Files:**
- Create: `web-landing/index.html`, `web-landing/de/index.html`, `web-landing/style.css`, `web-landing/robots.txt`, `web-landing/sitemap.xml`
- Copy: 3 screenshots from `mobile/marketing/screenshots/` into `web-landing/img/`

- [ ] **Step 1: Create `web-landing/style.css`**:

```css
:root { --fg: #0a0a0a; --muted: #525252; --bg: #fafafa; --accent: #5C9319; --border: #e5e5e5; }
* { box-sizing: border-box; margin: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: var(--fg); background: var(--bg); line-height: 1.6; }
.wrap { max-width: 960px; margin: 0 auto; padding: 0 1.25rem; }
header.hero { text-align: center; padding: 4rem 0 3rem; }
.hero h1 { font-size: clamp(1.8rem, 5vw, 3rem); letter-spacing: -0.03em; }
.hero h1 span { color: var(--accent); }
.hero p.lede { color: var(--muted); max-width: 54ch; margin: 1rem auto 2rem; }
.badge img { height: 64px; }
.shots { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; padding: 2rem 0; }
.shots img { width: 240px; border: 1px solid var(--border); border-radius: 18px; }
section { padding: 2.5rem 0; }
h2 { font-size: 1.5rem; letter-spacing: -0.02em; margin-bottom: 1rem; }
.steps { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.step { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; }
.step b { display: block; margin-bottom: 0.4rem; }
details { background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 0.9rem 1.1rem; margin-bottom: 0.6rem; }
summary { font-weight: 600; cursor: pointer; }
footer { color: var(--muted); font-size: 0.85rem; text-align: center; padding: 3rem 0; border-top: 1px solid var(--border); margin-top: 3rem; }
footer a { color: var(--muted); }
```

- [ ] **Step 2: Create `web-landing/index.html`**:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Export Komoot tours as GPX — free Android app | Export GPX for Komoot</title>
  <meta name="description" content="Download your own Komoot tours — including private ones — as standard GPX files for Garmin, Wahoo, bike computers and GPS watches. Free Android app.">
  <link rel="canonical" href="https://velologic-labs.eu/">
  <link rel="alternate" hreflang="en" href="https://velologic-labs.eu/">
  <link rel="alternate" hreflang="de" href="https://velologic-labs.eu/de/">
  <link rel="stylesheet" href="/style.css">
  <meta property="og:title" content="Export Komoot tours as GPX — free Android app">
  <meta property="og:description" content="Your routes, any device. Export Komoot tours as GPX for Garmin, Wahoo and more.">
  <meta property="og:image" content="https://velologic-labs.eu/img/feature-graphic.png">
  <meta property="og:url" content="https://velologic-labs.eu/">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Export GPX for Komoot",
    "operatingSystem": "ANDROID",
    "applicationCategory": "UtilitiesApplication",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR" },
    "url": "https://play.google.com/store/apps/details?id=com.velologiclabs.gpxexporter"
  }
  </script>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <h1>Export Komoot tours as <span>GPX</span></h1>
      <p class="lede">Download your own Komoot routes — including private ones — as standard GPX files for your Garmin, Wahoo, bike computer or GPS watch. Free Android app.</p>
      <a class="badge" href="https://play.google.com/store/apps/details?id=com.velologiclabs.gpxexporter">
        <img alt="Get it on Google Play" src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png">
      </a>
    </header>

    <div class="shots">
      <img src="/img/02-list.png" alt="Tour list with map previews" loading="lazy">
      <img src="/img/03-detail.png" alt="Tour detail with route map" loading="lazy">
      <img src="/img/04-saved.png" alt="GPX saved confirmation" loading="lazy">
    </div>

    <section>
      <h2>How it works</h2>
      <div class="steps">
        <div class="step"><b>1. Sign in with Komoot</b>A secure Komoot login page opens inside the app — we never see your password.</div>
        <div class="step"><b>2. Pick a tour</b>Browse every recorded and planned route, or share a tour from the Komoot app (Share → Export GPX).</div>
        <div class="step"><b>3. Save the GPX</b>One tap saves a standard GPX 1.1 file anywhere on your phone, ready for any device.</div>
      </div>
    </section>

    <section>
      <h2>Frequently asked questions</h2>
      <details><summary>How do I export a GPX file from Komoot?</summary><p>Install Export GPX for Komoot, sign in with your Komoot account, open any tour and tap GPX. The file is saved wherever you choose — Downloads, Google Drive or Dropbox.</p></details>
      <details><summary>Does it work with private tours?</summary><p>Yes. You sign in with your own account, so the app sees exactly the tours you see — recorded and planned, public and private.</p></details>
      <details><summary>Which devices can use the GPX file?</summary><p>Any device or app that imports GPX: Garmin Connect, Wahoo, Hammerhead, Bryton, Coros, Suunto, OsmAnd, Locus Map, Gaia GPS and more.</p></details>
      <details><summary>Is it free?</summary><p>Yes — the app is free and shows a small banner ad.</p></details>
    </section>

    <footer>
      <p>© VeloLogic Labs · <a href="https://kubakunc.github.io/komoot-to-gpx/privacy-policy/">Privacy policy</a> · contact@velologic-labs.eu</p>
      <p>Not affiliated with komoot GmbH. "Komoot" is a trademark of komoot GmbH.</p>
    </footer>
  </div>
</body>
</html>
```

- [ ] **Step 3: Create `web-landing/de/index.html`** — same structure translated to German, with `lang="de"`, canonical `https://velologic-labs.eu/de/`, the same hreflang pair, title `Komoot Touren als GPX exportieren — kostenlose Android-App`, meta description `Lade deine eigenen Komoot Touren — auch private — als GPX-Dateien für Garmin, Wahoo, Radcomputer und GPS-Uhren herunter. Kostenlose Android-App.`, and all section texts translated (hero, 3 steps, 4 FAQ items, footer). Image paths stay `/img/...`, badge image swapped to `de_badge_web_generic.png` with `hl=de` link param.

- [ ] **Step 4: Create `web-landing/robots.txt`**:

```
User-agent: *
Allow: /
Sitemap: https://velologic-labs.eu/sitemap.xml
```

- [ ] **Step 5: Create `web-landing/sitemap.xml`**:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://velologic-labs.eu/</loc></url>
  <url><loc>https://velologic-labs.eu/de/</loc></url>
</urlset>
```

- [ ] **Step 6: Copy the images**

```bash
mkdir -p web-landing/img
cp mobile/marketing/screenshots/0{2,3,4}-*.png web-landing/img/
cp mobile/marketing/out/feature-graphic.png web-landing/img/
```

- [ ] **Step 7: Smoke-test locally**

Run: `cd web-landing && python3 -m http.server 8400` → open `http://localhost:8400`, check both pages render, images load, links work. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add web-landing/
git commit -m "feat(landing): static SEO landing page (EN + DE) for velologic-labs.eu"
```

- [ ] **Step 9 (manual, user): FTP upload** — upload the *contents* of `web-landing/` to the web root of velologic-labs.eu (next to `app-ads.txt`). Verify `https://velologic-labs.eu/` and `https://velologic-labs.eu/de/` load.

### Task 8: Manual Play Console paste session (user)

No files. Checklist for the user, after Tasks 1-3 are merged:

- [ ] Play Console → Main store listing: paste new EN short + full description.
- [ ] Add language → German (de-DE): paste from `play-store-listing-de.md`.
- [ ] Repeat for nl-NL, fr-FR, it-IT, es-ES, pl-PL.
- [ ] Submit for review (one publishing pass for all languages).

---

## Self-review notes

- Spec §1 → Task 1, §2 → Tasks 2-3, §3 → Tasks 4-5, §4 → Task 7, §5 → Task 6, §6 → no task (manual weekly glance). Covered.
- Review trigger formula consistent across Task 4 test and implementation: 2, then 7, 12, 17.
- `SAVE_COUNT_KEY` exported from `review.ts` and imported by both pages — removes today's duplication.
- Versions/release: per user rule, NO versionCode bump in this plan — release happens only when the user says so.
