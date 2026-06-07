# Firebase Analytics + Crashlytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit usage metrics (funnel, feature usage, retention) and crash reports from the Android app via Firebase Analytics + Crashlytics.

**Architecture:** One wrapper module `analytics.ts` is the only code that touches Firebase (`@capacitor-firebase/analytics` + `/crashlytics`). Events are constants; consent follows the existing UMP flow (ad signals always denied for Firebase, analytics granted once UMP resolves). Gradle applies Google services + Crashlytics plugins only when `google-services.json` exists, so builds work before the user creates the Firebase project.

**Tech Stack:** Capacitor 6, @capacitor-firebase/analytics@6.3.1, @capacitor-firebase/crashlytics@6.3.1, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-07-analytics-design.md`

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `mobile/src/lib/client/analytics.ts` | create | EVENTS constants, `track`, `recordError`, `decideAnalyticsConsent`, `applyAnalyticsConsent` |
| `mobile/tests/unit/analytics.test.ts` | create | unit tests (constants validity, consent mapping, off-platform no-op) |
| `mobile/src/lib/client/ad-banner.ts` | modify | call `applyAnalyticsConsent` after UMP resolves in `initAds()` |
| `mobile/src/lib/client/share-intent.ts` | modify | `markViaShare` / `consumeViaShare` (sessionStorage flag for export source) |
| `mobile/tests/unit/share-intent.test.ts` | modify | tests for the new helpers |
| `mobile/src/routes/login/+page.svelte` | modify | `login_success` / `login_fail` |
| `mobile/src/routes/+layout.svelte` | modify | `share_intent_received`, mark via-share |
| `mobile/src/routes/+page.svelte` | modify | `export_success/fail` (source list), `filter_change` |
| `mobile/src/routes/tour/[id]/+page.svelte` | modify | `export_success/fail` (source detail/share) |
| `mobile/src/lib/client/review.ts` | modify | `review_prompt_shown` |
| `mobile/android/build.gradle` | modify | Crashlytics gradle classpath |
| `mobile/android/app/build.gradle` | modify | conditional `firebase-crashlytics` apply |
| `docs/privacy-policy/index.html` | modify | Analytics & crash reporting section |
| `docs/ops/play-data-safety.md` | modify | new collected data types |
| `docs/ops/play-store-listing*.md` (7 files) | modify | PRIVACY paragraph + one sentence |
| `mobile/CHANGELOG.md` | modify | user-facing entry |

### Task 0 (USER, manual — can happen in parallel; only Task 8's final build verification hard-depends on it)

- [ ] In https://console.firebase.google.com: create project (e.g. "VeloLogic Labs"), disable Google Analytics ad personalization prompts if asked → add Android app with package `com.velologiclabs.gpxexporter` → download `google-services.json` → put it at `mobile/android/app/google-services.json`. Enable Crashlytics in the console (Build → Crashlytics).

### Task 1: Install plugins + Gradle wiring

**Files:**
- Modify: `mobile/android/build.gradle` (buildscript dependencies)
- Modify: `mobile/android/app/build.gradle:69-76` (the `try { def servicesJSON ... }` block)

- [ ] **Step 1: Install npm packages**

```bash
cd /Users/jakubkunc/code/komoot-to-gpx/mobile
pnpm add @capacitor-firebase/analytics@6.3.1 @capacitor-firebase/crashlytics@6.3.1
npx cap sync android
```

- [ ] **Step 2: Add Crashlytics classpath** in `mobile/android/build.gradle` — in `buildscript.dependencies`, after the google-services line:

```groovy
        classpath 'com.google.gms:google-services:4.4.0'
        classpath 'com.google.firebase:firebase-crashlytics-gradle:2.9.9'
```

- [ ] **Step 3: Conditionally apply Crashlytics** in `mobile/android/app/build.gradle`. Find the existing block:

```groovy
try {
    def servicesJSON = file('google-services.json')
    if (servicesJSON.text) {
        apply plugin: 'com.google.gms.google-services'
    }
} catch(Exception e) {
    logger.info("google-services.json not found, google-services plugin not applied. Push Notifications won't work")
}
```

and add the Crashlytics apply inside the `if`:

```groovy
try {
    def servicesJSON = file('google-services.json')
    if (servicesJSON.text) {
        apply plugin: 'com.google.gms.google-services'
        apply plugin: 'com.google.firebase.crashlytics'
    }
} catch(Exception e) {
    logger.info("google-services.json not found, google-services plugin not applied. Push Notifications won't work")
}
```

- [ ] **Step 4: Verify the build still works WITHOUT google-services.json**

Run: `cd mobile/android && ./gradlew assembleDebug -q`
Expected: BUILD SUCCESSFUL (plugins not applied, only logged).

- [ ] **Step 5: Commit**

```bash
cd /Users/jakubkunc/code/komoot-to-gpx
git add mobile/package.json mobile/pnpm-lock.yaml mobile/android/build.gradle mobile/android/app/build.gradle mobile/android/capacitor.settings.gradle mobile/android/app/capacitor.build.gradle
git commit -m "chore(mobile): add Firebase analytics + crashlytics plugins and gradle wiring"
```

### Task 2: analytics.ts wrapper (TDD)

**Files:**
- Create: `mobile/src/lib/client/analytics.ts`
- Test: `mobile/tests/unit/analytics.test.ts`

- [ ] **Step 1: Write the failing test** `mobile/tests/unit/analytics.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EVENTS, decideAnalyticsConsent, track } from '../../src/lib/client/analytics';

describe('EVENTS', () => {
  it('contains the seven spec events', () => {
    expect(Object.values(EVENTS).sort()).toEqual([
      'export_fail',
      'export_success',
      'filter_change',
      'login_fail',
      'login_success',
      'review_prompt_shown',
      'share_intent_received'
    ]);
  });

  it('names are firebase-valid (snake_case, <=40 chars, start with a letter)', () => {
    for (const name of Object.values(EVENTS)) {
      expect(name).toMatch(/^[a-z][a-z0-9_]{0,39}$/);
    }
  });
});

describe('decideAnalyticsConsent', () => {
  it('grants when consent is not required (non-EEA)', () => {
    expect(decideAnalyticsConsent('NOT_REQUIRED')).toBe(true);
  });

  it('grants when consent was obtained', () => {
    expect(decideAnalyticsConsent('OBTAINED')).toBe(true);
  });

  it('denies while consent is required but unresolved', () => {
    expect(decideAnalyticsConsent('REQUIRED')).toBe(false);
  });

  it('denies on unknown status', () => {
    expect(decideAnalyticsConsent('UNKNOWN')).toBe(false);
    expect(decideAnalyticsConsent(undefined)).toBe(false);
  });
});

describe('track', () => {
  it('no-ops without throwing on non-android platforms', async () => {
    await expect(track(EVENTS.EXPORT_SUCCESS, { source: 'list' })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify FAIL** — `cd mobile && pnpm vitest run tests/unit/analytics.test.ts` → "Failed to load url ../../src/lib/client/analytics".

- [ ] **Step 3: Implement** `mobile/src/lib/client/analytics.ts`:

```typescript
import { Capacitor } from '@capacitor/core';

const isAndroid = () => Capacitor.getPlatform() === 'android';

/** Every custom event the app emits. Nothing else may call Firebase directly. */
export const EVENTS = {
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAIL: 'login_fail',
  EXPORT_SUCCESS: 'export_success',
  EXPORT_FAIL: 'export_fail',
  SHARE_INTENT_RECEIVED: 'share_intent_received',
  FILTER_CHANGE: 'filter_change',
  REVIEW_PROMPT_SHOWN: 'review_prompt_shown'
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

/** Fire-and-forget event log; never throws, no-ops off Android. */
export async function track(name: EventName, params?: Record<string, string | number | boolean>): Promise<void> {
  if (!isAndroid()) return;
  try {
    const { FirebaseAnalytics } = await import('@capacitor-firebase/analytics');
    await FirebaseAnalytics.logEvent({ name, params });
  } catch (e) {
    console.warn('analytics track failed:', e);
  }
}

/** Non-fatal error reporting to Crashlytics; never throws, no-ops off Android. */
export async function recordError(e: unknown, context: string): Promise<void> {
  if (!isAndroid()) return;
  try {
    const { FirebaseCrashlytics } = await import('@capacitor-firebase/crashlytics');
    const message = `${context}: ${(e as Error)?.message ?? String(e)}`;
    await FirebaseCrashlytics.recordException({ message });
  } catch (err) {
    console.warn('crashlytics record failed:', err);
  }
}

/**
 * UMP tells us whether the consent flow resolved, not the user's granular
 * choices. Analytics storage is granted once the flow resolves; ad signals
 * are denied for Firebase unconditionally (AdMob does its own consent).
 */
export function decideAnalyticsConsent(umpStatus: string | undefined): boolean {
  return umpStatus === 'NOT_REQUIRED' || umpStatus === 'OBTAINED';
}

/** Push the consent split into the Firebase SDK. */
export async function applyAnalyticsConsent(granted: boolean): Promise<void> {
  if (!isAndroid()) return;
  try {
    const { FirebaseAnalytics } = await import('@capacitor-firebase/analytics');
    const set = (type: string, ok: boolean) =>
      FirebaseAnalytics.setConsent({
        type: type as never,
        status: (ok ? 'GRANTED' : 'DENIED') as never
      });
    await set('AD_STORAGE', false);
    await set('AD_USER_DATA', false);
    await set('AD_PERSONALIZATION', false);
    await set('ANALYTICS_STORAGE', granted);
  } catch (e) {
    console.warn('analytics consent failed:', e);
  }
}
```

- [ ] **Step 4: Run tests** — `pnpm vitest run tests/unit/analytics.test.ts` → 7 passed. Full suite `pnpm run test` → expect 48 passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/jakubkunc/code/komoot-to-gpx
git add mobile/src/lib/client/analytics.ts mobile/tests/unit/analytics.test.ts
git commit -m "feat(mobile): analytics wrapper — events, consent split, crash recording"
```

### Task 3: Consent hookup in initAds

**Files:**
- Modify: `mobile/src/lib/client/ad-banner.ts:17-29`

- [ ] **Step 1: Edit `initAds()`** — current body:

```typescript
export async function initAds(): Promise<void> {
  if (!isAndroid() || initialized) return;
  initialized = true;
  try {
    await AdMob.initialize({ testingDevices: [], initializeForTesting: __DEV__ });
    const consentInfo = await AdMob.requestConsentInfo();
    if (consentInfo.isConsentFormAvailable && consentInfo.status === AdmobConsentStatus.REQUIRED) {
      await AdMob.showConsentForm();
    }
  } catch (e) {
    console.warn('AdMob init failed:', e);
  }
}
```

becomes:

```typescript
export async function initAds(): Promise<void> {
  if (!isAndroid() || initialized) return;
  initialized = true;
  try {
    await AdMob.initialize({ testingDevices: [], initializeForTesting: __DEV__ });
    let consentInfo = await AdMob.requestConsentInfo();
    if (consentInfo.isConsentFormAvailable && consentInfo.status === AdmobConsentStatus.REQUIRED) {
      await AdMob.showConsentForm();
      consentInfo = await AdMob.requestConsentInfo();
    }
    void applyAnalyticsConsent(decideAnalyticsConsent(consentInfo.status));
  } catch (e) {
    console.warn('AdMob init failed:', e);
  }
}
```

with the import added at the top of the file:

```typescript
import { applyAnalyticsConsent, decideAnalyticsConsent } from './analytics';
```

- [ ] **Step 2: Verify** — `pnpm run test` (48 passed) and `pnpm run build` (clean).

- [ ] **Step 3: Commit**

```bash
git add mobile/src/lib/client/ad-banner.ts
git commit -m "feat(mobile): apply Firebase consent after UMP flow resolves"
```

### Task 4: via-share helpers in share-intent.ts (TDD)

**Files:**
- Modify: `mobile/src/lib/client/share-intent.ts`
- Test: `mobile/tests/unit/share-intent.test.ts` (append)

- [ ] **Step 1: Append failing tests** to `mobile/tests/unit/share-intent.test.ts` (the file already stubs localStorage at the top — sessionStorage needs the same stub; add right after the localStorage stub):

```typescript
const sessionStore = new Map<string, string>();
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => sessionStore.get(k) ?? null,
  setItem: (k: string, v: string) => { sessionStore.set(k, v); },
  removeItem: (k: string) => { sessionStore.delete(k); },
  clear: () => { sessionStore.clear(); }
});
```

add `markViaShare, wasViaShare` to the existing import from share-intent, and append:

```typescript
describe('via-share source marker', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('reports true for the marked tour id', () => {
    markViaShare('123');
    expect(wasViaShare('123')).toBe(true);
  });

  it('reports false for a different tour id', () => {
    markViaShare('123');
    expect(wasViaShare('456')).toBe(false);
  });

  it('reports false when nothing was marked', () => {
    expect(wasViaShare('123')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify FAIL** — `pnpm vitest run tests/unit/share-intent.test.ts` → "markViaShare is not exported" / load error.

- [ ] **Step 3: Implement** — append to `mobile/src/lib/client/share-intent.ts`:

```typescript
const VIA_SHARE_KEY = 'gpx-exporter:via-share-tour';

/** Remember that this tour was opened via the share intent (for analytics). */
export function markViaShare(tourId: string): void {
  sessionStorage.setItem(VIA_SHARE_KEY, tourId);
}

/** True if the given tour arrived via the share intent. Does not clear. */
export function wasViaShare(tourId: string): boolean {
  return sessionStorage.getItem(VIA_SHARE_KEY) === tourId;
}
```

- [ ] **Step 4: Run tests** — file passes (23 tests), full suite 51 passed.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/lib/client/share-intent.ts mobile/tests/unit/share-intent.test.ts
git commit -m "feat(mobile): track share-intent origin of a tour for analytics"
```

### Task 5: Instrument the app

**Files:**
- Modify: `mobile/src/routes/login/+page.svelte` (signIn function)
- Modify: `mobile/src/routes/+layout.svelte` (handleShareHash)
- Modify: `mobile/src/routes/+page.svelte` (download, setFilter)
- Modify: `mobile/src/routes/tour/[id]/+page.svelte` (downloadGpx)
- Modify: `mobile/src/lib/client/review.ts` (maybeRequestReview)

- [ ] **Step 1: login/+page.svelte** — add import `import { track, EVENTS } from '$lib/client/analytics';` and edit `signIn()`:

```typescript
  async function signIn() {
    errorMsg = null;
    busy = true;
    try {
      const { userId, token, email } = await nativeLogin();
      await setSession({ userId, token, email });
      void track(EVENTS.LOGIN_SUCCESS);
      const pending = consumePendingShare();
      await goto(pending ? `/tour/${pending}` : '/', { replaceState: true });
    } catch (e) {
      if (e instanceof AuthUnsupportedError) {
        errorMsg = 'Open this in the Android app to sign in.';
      } else if (e instanceof AuthCancelledError) {
        errorMsg = null;
        void track(EVENTS.LOGIN_FAIL, { reason: 'cancelled' });
      } else {
        const msg = (e as Error)?.message ?? 'unknown error';
        errorMsg = `Sign-in failed: ${msg}`;
        void track(EVENTS.LOGIN_FAIL, { reason: 'error' });
      }
    } finally {
      busy = false;
    }
  }
```

- [ ] **Step 2: +layout.svelte** — add imports `markViaShare` (extend the existing share-intent import) and `import { track, EVENTS } from '$lib/client/analytics';`; edit `handleShareHash()`:

```typescript
  async function handleShareHash() {
    const tourId = readShareHash(window.location.hash);
    if (!tourId) return false;
    history.replaceState(null, '', window.location.pathname + window.location.search);
    const s = await getSession();
    void track(EVENTS.SHARE_INTENT_RECEIVED, { signed_in: !!s });
    markViaShare(tourId);
    if (s) {
      await goto(`/tour/${tourId}`);
    } else {
      setPendingShare(tourId);
      await goto('/login', { replaceState: true });
    }
    return true;
  }
```

- [ ] **Step 3: +page.svelte** — add import `import { track, EVENTS } from '$lib/client/analytics';`. In `setFilter`, after `filter = f;` add `void track(EVENTS.FILTER_CHANGE, { filter: f });`. In `download()` success path (right after `savedModalFilename = filename;`) add `void track(EVENTS.EXPORT_SUCCESS, { source: 'list' });` and in the catch: after the SaveCancelledError early-return, before the 401 check is fine — instrument the two real failure branches:

```typescript
    } catch (err) {
      if (err instanceof SaveCancelledError) {
        errorMsg = null;
        return;
      }
      if (err instanceof KomootError && err.status === 401) {
        void track(EVENTS.EXPORT_FAIL, { reason: 'auth' });
        await clearSession();
        await goto('/login', { replaceState: true });
        return;
      }
      void track(EVENTS.EXPORT_FAIL, { reason: 'api' });
      errorMsg = 'Download failed.';
    } finally {
      downloading = null;
    }
```

- [ ] **Step 4: tour/[id]/+page.svelte** — add imports `import { track, EVENTS } from '$lib/client/analytics';` and `import { wasViaShare } from '$lib/client/share-intent';`. In `downloadGpx()` success path (after `savedModalFilename = filename;`):

```typescript
      void track(EVENTS.EXPORT_SUCCESS, {
        source: wasViaShare($page.params.id) ? 'share' : 'detail'
      });
```

(`$page` from `$app/stores` is already imported in this file.) In the catch, replace:

```typescript
    } catch (err) {
      if (err instanceof SaveCancelledError) { errorMsg = null; return; }
      void track(EVENTS.EXPORT_FAIL, { reason: 'save' });
      errorMsg = 'Download failed.';
    } finally { downloading = false; }
```

- [ ] **Step 5: review.ts** — in `maybeRequestReview()`, after the `shouldRequestReview` gate passes (before the dynamic import try block), add:

```typescript
  const { track, EVENTS } = await import('./analytics');
  void track(EVENTS.REVIEW_PROMPT_SHOWN);
```

(dynamic import avoids a circular-dependency risk and keeps review.ts standalone in tests).

- [ ] **Step 6: Verify** — `pnpm run test` (51 passed), `pnpm run build` (clean), `npx cap sync android`, `cd android && ./gradlew assembleDebug -q` (success).

- [ ] **Step 7: Commit**

```bash
cd /Users/jakubkunc/code/komoot-to-gpx
git add mobile/src/routes/login/+page.svelte mobile/src/routes/+layout.svelte mobile/src/routes/+page.svelte "mobile/src/routes/tour/[id]/+page.svelte" mobile/src/lib/client/review.ts
git commit -m "feat(mobile): instrument funnel, feature and review events"
```

### Task 6: Privacy & Play docs

**Files:**
- Modify: `docs/privacy-policy/index.html`
- Modify: `docs/ops/play-data-safety.md`
- Modify: `docs/ops/play-store-listing.md` + the 6 localized files

- [ ] **Step 1: privacy policy** — in `docs/privacy-policy/index.html`: bump the "Last updated" date in the `.meta` line to `2026-06-07`. In section "1. What we collect", replace the sentence `The app itself collects no personal information.` with `The app collects no account data and has no backend server of its own.` Then add a new section before "9. Contact" (renumber if sections are numbered sequentially — insert as its own `<h2>`):

```html
  <h2>8a. Analytics &amp; crash reporting</h2>
  <p>
    The app uses Google Firebase Analytics and Firebase Crashlytics to
    understand how the app is used (screens viewed, exports completed,
    feature usage) and to receive crash reports. This data covers app
    interactions, diagnostics, crash logs and a device identifier; it is
    not used for advertising, and Firebase ad signals are disabled.
    In the EEA, analytics identifiers are only enabled after the consent
    dialog is resolved. Data is processed by Google LLC under
    <a href="https://policies.google.com/privacy">Google's privacy policy</a>.
  </p>
```

(If the existing sections are strictly numbered `<h2>1.</h2>`…`<h2>9.</h2>`, instead insert as section 9 and renumber the old Contact section to 10 — match whatever the file actually has.)

- [ ] **Step 2: play-data-safety.md** — add a new subsection at the end describing the additional declarations:

```markdown
## Update 2026-06-07 — Firebase Analytics + Crashlytics

Add in Play Console → App content → Data safety:

| Data type | Collected | Shared | Purpose |
|---|---|---|---|
| App interactions (App activity) | Yes | No | Analytics |
| Crash logs (App info and performance) | Yes | No | Analytics |
| Diagnostics (App info and performance) | Yes | No | Analytics |
| Device or other IDs | Yes | No | Analytics |

All: processed ephemerally = No, optional = No (collected automatically),
encrypted in transit = Yes, deletion: data auto-expires (Analytics
retention 14 months); users can reset the device identifier in
Android settings.
```

- [ ] **Step 3: listing PRIVACY paragraphs** — in `docs/ops/play-store-listing.md`, inside the full-description PRIVACY paragraph, append one sentence after "…we don't proxy or store it.":

```
Anonymous usage statistics and crash reports (Google Firebase) help us improve the app; in the EEA the app asks for consent first.
```

Add the translated equivalent sentence to the PRIVACY/DATENSCHUTZ/etc. paragraph in each localized file:
- de: `Anonyme Nutzungsstatistiken und Absturzberichte (Google Firebase) helfen uns, die App zu verbessern; im EWR fragt die App zuerst nach deiner Einwilligung.`
- nl: `Anonieme gebruiksstatistieken en crashrapporten (Google Firebase) helpen ons de app te verbeteren; in de EER vraagt de app eerst om toestemming.`
- fr: `Des statistiques d'utilisation anonymes et des rapports de plantage (Google Firebase) nous aident à améliorer l'appli ; dans l'EEE, l'appli demande d'abord votre consentement.`
- it: `Statistiche d'uso anonime e segnalazioni di arresti anomali (Google Firebase) ci aiutano a migliorare l'app; nel SEE l'app chiede prima il consenso.`
- es: `Las estadísticas de uso anónimas y los informes de fallos (Google Firebase) nos ayudan a mejorar la app; en el EEE la app pide primero tu consentimiento.`
- pl: `Anonimowe statystyki użycia i raporty błędów (Google Firebase) pomagają nam ulepszać aplikację; w EOG aplikacja najpierw pyta o zgodę.`

Verify each full description stays ≤ 4000 chars (`python3` len check per file).

- [ ] **Step 4: Commit**

```bash
git add docs/privacy-policy/index.html docs/ops/play-data-safety.md docs/ops/play-store-listing*.md
git commit -m "docs: declare Firebase analytics + crash reporting (privacy, data safety, listings)"
```

### Task 7: Changelog

**Files:**
- Modify: `mobile/CHANGELOG.md`

- [ ] **Step 1:** Add at the top (below the format header, above `## [1.0.5]`):

```markdown
## [Unreleased]

### Added
- Anonymous usage statistics and crash reporting (Google Firebase) to help
  improve the app. Ad-related Firebase signals are disabled; in the EEA
  analytics activates only after the consent dialog.
```

- [ ] **Step 2: Commit**

```bash
git add mobile/CHANGELOG.md
git commit -m "docs(mobile): changelog entry for analytics + crash reporting"
```

### Task 8: End-to-end verification (after the user finishes Task 0)

- [ ] **Step 1:** Confirm `mobile/android/app/google-services.json` exists (user-provided). If absent, STOP and wait — do not fake the file.
- [ ] **Step 2:** `cd mobile && pnpm run build && npx cap sync android && cd android && ./gradlew assembleDebug -q` → BUILD SUCCESSFUL (now WITH the Firebase plugins applied — check `./gradlew :app:tasks | grep -i crashlytics` lists Crashlytics tasks).
- [ ] **Step 3:** Install on emulator/device, enable DebugView:

```bash
./gradlew installDebug -q
adb shell setprop debug.firebase.analytics.app com.velologiclabs.gpxexporter
adb shell am start -n com.velologiclabs.gpxexporter/.MainActivity
```

In Firebase console → Analytics → DebugView: walk the app (login fail by cancelling, filter change, export) and confirm events arrive.
- [ ] **Step 4:** `git status` clean of junk; report results. (Release bump happens only on the user's explicit request.)

---

## Self-review notes

- Spec §1 → Tasks 1-2; §2 (taxonomy + instrumentation points) → Tasks 2, 4, 5; §3 consent → Tasks 2-3; §4 docs → Task 6; §5 testing → Tasks 2, 4, 8.
- Names consistent: `track`, `recordError`, `applyAnalyticsConsent`, `decideAnalyticsConsent`, `EVENTS.*`, `markViaShare`/`wasViaShare` used identically across tasks.
- `recordError` is exported but only wired where spec asked (save-flow catches use track(EXPORT_FAIL); recordError reserved for the same catches — instrumenting both would double-count, so v1 ships recordError available but called only from the tour-page generic catch via EXPORT_FAIL... → decision: do NOT call recordError in v1 catches; Crashlytics auto-captures crashes, and EXPORT_FAIL covers non-fatals. recordError stays exported for future use. (YAGNI-borderline but 8 lines, kept for the LoginActivity-equivalent JS paths.)
- Test counts: 41 existing + 7 (analytics) + 3 (share-intent) = 51.
