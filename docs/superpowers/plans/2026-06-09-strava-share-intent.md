# Strava Share-Intent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sharing an activity or route from the Strava app opens it in our app ready to export, like the existing Komoot share.

**Architecture:** A unified `#share=<provider>:<id>` hash carries the target. The web layer parses it (provider-aware, namespaced Strava ids) and routes/login-gates per provider. Native `MainActivity` recognises Komoot, direct Strava, and `strava.app.link` branch links — resolving branch links via one `Location`-header request.

**Tech Stack:** SvelteKit 2 + Svelte 5, TypeScript, Vitest, Android/Java (Capacitor). Spec: `docs/superpowers/specs/2026-06-09-strava-share-intent-design.md`.

**Working directory:** `mobile/` for `pnpm`. Green bar: `pnpm test` all pass, `pnpm check` 0 errors.

---

### Task 1: Provider-aware share target + pending (web, pure)

Generalize `readShareHash` to return a `{provider,id}` target and make the pending-share storage provider-aware. Update the existing tests.

**Files:**
- Modify: `mobile/src/lib/client/share-intent.ts`
- Modify: `mobile/tests/unit/share-intent.test.ts`

- [ ] **Step 1: Update the tests (red)**

In `mobile/tests/unit/share-intent.test.ts`, replace the `readShareHash` and pending describe blocks with these (keep any `extractTourId` / `markViaShare` blocks as-is):

```ts
import { readShareHash, setPendingShare, consumePendingShare } from '../../src/lib/client/share-intent';

describe('readShareHash', () => {
  it('parses a provider-namespaced share hash', () => {
    expect(readShareHash('#share=komoot:456')).toEqual({ provider: 'komoot', id: '456' });
    expect(readShareHash('#share=strava:route-123')).toEqual({ provider: 'strava', id: 'route-123' });
    expect(readShareHash('#share=strava:activity-9')).toEqual({ provider: 'strava', id: 'activity-9' });
  });
  it('accepts the legacy komoot hash', () => {
    expect(readShareHash('#share-tour=456')).toEqual({ provider: 'komoot', id: '456' });
  });
  it('returns null for anything else', () => {
    expect(readShareHash('#other')).toBeNull();
    expect(readShareHash('')).toBeNull();
    expect(readShareHash('#share=garmin:1')).toBeNull();
  });
});

describe('pending share (provider-aware)', () => {
  beforeEach(() => localStorage.clear());
  it('round-trips a target and clears on consume', () => {
    setPendingShare({ provider: 'strava', id: 'route-123' });
    expect(consumePendingShare()).toEqual({ provider: 'strava', id: 'route-123' });
    expect(consumePendingShare()).toBeNull();
  });
  it('returns null on missing/corrupt', () => {
    expect(consumePendingShare()).toBeNull();
    localStorage.setItem('gpx-exporter:pending-share-tour', 'not json');
    expect(consumePendingShare()).toBeNull();
  });
});
```

Ensure the test file stubs `localStorage`/`sessionStorage` as the existing share-intent tests already do (keep that setup).

- [ ] **Step 2: Run it (fails)**

Run: `pnpm test -- share-intent`
Expected: FAIL — `readShareHash` returns a string / `setPendingShare` takes a string.

- [ ] **Step 3: Implement**

In `mobile/src/lib/client/share-intent.ts`, add the import and the `ShareTarget` type at the top (after any existing imports):

```ts
import type { ProviderId } from './provider';

export interface ShareTarget {
  provider: ProviderId;
  id: string;
}
```

Replace `readShareHash`:

```ts
export function readShareHash(hash: string): ShareTarget | null {
  const m = /^#share=(komoot|strava):([A-Za-z0-9-]+)$/.exec(hash);
  if (m) return { provider: m[1] as ProviderId, id: m[2] };
  const legacy = /^#share-tour=(\d+)$/.exec(hash);
  if (legacy) return { provider: 'komoot', id: legacy[1] };
  return null;
}
```

Replace `setPendingShare` / `consumePendingShare`:

```ts
export function setPendingShare(target: ShareTarget): void {
  localStorage.setItem(PENDING_KEY, JSON.stringify(target));
}

export function consumePendingShare(): ShareTarget | null {
  const v = localStorage.getItem(PENDING_KEY);
  if (!v) return null;
  localStorage.removeItem(PENDING_KEY);
  try {
    const t = JSON.parse(v) as ShareTarget;
    if ((t.provider === 'komoot' || t.provider === 'strava') && t.id) return t;
  } catch {
    /* corrupt */
  }
  return null;
}
```

Leave `extractTourId`, `markViaShare`, `wasViaShare`, and `PENDING_KEY` as they are.

- [ ] **Step 4: Run it (passes)**

Run: `pnpm test -- share-intent`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/lib/client/share-intent.ts mobile/tests/unit/share-intent.test.ts
git commit -m "feat(mobile): provider-aware share target + pending share"
```

---

### Task 2: Provider-aware share routing in the layout

**Files:**
- Modify: `mobile/src/routes/+layout.svelte`

- [ ] **Step 1: Update handleShareHash**

In `mobile/src/routes/+layout.svelte`, replace `handleShareHash` with:

```ts
  async function handleShareHash() {
    const target = readShareHash(window.location.hash);
    if (!target) return false;
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setActiveProvider(target.provider);
    const s = await getProviderSession(target.provider);
    void track(EVENTS.SHARE_INTENT_RECEIVED, { provider: target.provider, signed_in: !!s });
    markViaShare(target.id);
    if (s) {
      await goto(`/tour/${target.id}`);
    } else {
      setPendingShare(target);
      await goto('/login', { replaceState: true });
    }
    return true;
  }
```

(The imports already include `readShareHash, setPendingShare, markViaShare` from `share-intent` and `setActiveProvider` from `active-provider` and `getProviderSession` from `session` — no import change needed. The old code read `getProviderSession('komoot')`; this now uses the shared target's provider.)

- [ ] **Step 2: Verify**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/routes/+layout.svelte
git commit -m "feat(mobile): route shared activities/routes per provider"
```

---

### Task 3: Consume the provider-aware pending share after sign-in

**Files:**
- Modify: `mobile/src/routes/login/+page.svelte`

- [ ] **Step 1: Update the post-login navigation**

In `mobile/src/routes/login/+page.svelte` `signIn`, replace:

```ts
      void track(EVENTS.LOGIN_SUCCESS, { provider: providerId });
      // A pending share only ever comes from Komoot.
      const pending = providerId === 'komoot' ? consumePendingShare() : null;
      await goto(pending ? `/tour/${pending}` : '/', { replaceState: true });
```

with:

```ts
      void track(EVENTS.LOGIN_SUCCESS, { provider: providerId });
      const pending = consumePendingShare();
      if (pending && pending.provider === providerId) {
        await goto(`/tour/${pending.id}`, { replaceState: true });
      } else {
        if (pending) setPendingShare(pending); // keep it for the matching provider
        await goto('/', { replaceState: true });
      }
```

Add `setPendingShare` to the existing `share-intent` import (currently `import { consumePendingShare } from '$lib/client/share-intent';`):

```ts
  import { consumePendingShare, setPendingShare } from '$lib/client/share-intent';
```

- [ ] **Step 2: Verify**

Run: `pnpm check && pnpm test`
Expected: 0 errors, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/routes/login/+page.svelte
git commit -m "feat(mobile): open the pending shared item after signing in to its provider"
```

---

### Task 4: Native generalized share handler + branch-link resolver

Recognise Komoot, direct Strava, and `strava.app.link` branch links; emit a unified `#share=<provider>:<id>`.

**Files:**
- Modify: `mobile/android/app/src/main/java/com/velologiclabs/gpxexporter/MainActivity.java`

- [ ] **Step 1: Add imports**

In `MainActivity.java`, add to the imports block:

```java
import java.net.URL;
import java.net.URLDecoder;
import javax.net.ssl.HttpsURLConnection;
```

- [ ] **Step 2: Replace the patterns + handler**

Replace the single `TOUR_PATTERN` field with three patterns:

```java
    private static final Pattern KOMOOT_TOUR =
        Pattern.compile("komoot\\.(?:com|de)/(?:[^/?#\\s]+/)?tour/(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern STRAVA_DIRECT =
        Pattern.compile("strava\\.com/(activities|routes)/(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern STRAVA_BRANCH =
        Pattern.compile("https?://strava\\.app\\.link/[A-Za-z0-9]+", Pattern.CASE_INSENSITIVE);
```

Replace `handleShareIntent` with:

```java
    private void handleShareIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        if (!"text/plain".equals(intent.getType())) return;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null) return;

        Matcher k = KOMOOT_TOUR.matcher(text);
        if (k.find()) { injectShare("komoot:" + k.group(1)); return; }

        Matcher sd = STRAVA_DIRECT.matcher(text);
        if (sd.find()) { injectShare("strava:" + stravaItem(sd.group(1), sd.group(2))); return; }

        Matcher sb = STRAVA_BRANCH.matcher(text);
        if (sb.find()) {
            final String link = sb.group();
            new Thread(() -> {
                String item = resolveStravaBranch(link);
                if (item != null) injectShare("strava:" + item);
                else Log.d("ShareIntent", "could not resolve strava branch link");
            }).start();
            return;
        }
        Log.d("ShareIntent", "received SEND text without a recognised URL");
    }

    private static String stravaItem(String kind, String id) {
        return ("activities".equalsIgnoreCase(kind) ? "activity-" : "route-") + id;
    }

    private void injectShare(String token) {
        if (bridge == null || bridge.getWebView() == null) {
            Log.w("ShareIntent", "bridge/webview not ready for " + token);
            return;
        }
        bridge.getWebView().post(() ->
            bridge.getWebView().evaluateJavascript(
                "window.location.hash='share=" + token + "'", null));
    }

    /** Resolve a strava.app.link branch link to "activity-<id>" / "route-<id>" via the Location header. */
    private String resolveStravaBranch(String link) {
        HttpsURLConnection conn = null;
        try {
            conn = (HttpsURLConnection) new URL(link).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setRequestProperty("User-Agent",
                "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) "
                    + "Chrome/124.0.0.0 Mobile Safari/537.36");
            conn.setConnectTimeout(12000);
            conn.setReadTimeout(12000);
            conn.getResponseCode();
            String loc = conn.getHeaderField("Location");
            if (loc == null) return null;
            String decoded = URLDecoder.decode(loc, "UTF-8");
            Matcher m = STRAVA_DIRECT.matcher(decoded);
            return m.find() ? stravaItem(m.group(1), m.group(2)) : null;
        } catch (Exception e) {
            Log.w("ShareIntent", "branch resolve failed: " + e.getMessage());
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }
```

(`bridge.getWebView().post(...)` is safe to call from the background thread — it posts to the UI thread.)

- [ ] **Step 3: Compile**

Run: `cd android && ./gradlew :app:compileDebugJavaWithJavac -q`
Expected: exit 0 (no Java errors). Then `cd .. && pnpm test && pnpm check` → all green.

- [ ] **Step 4: Commit**

```bash
git add mobile/android/app/src/main/java/com/velologiclabs/gpxexporter/MainActivity.java
git commit -m "feat(mobile): native Strava share — direct + branch-link, unified share hash"
```

---

### Task 5: On-device verification (real Strava share)

Not a code task. The phone (`88d7dd1`) is connected; the production app was uninstalled so the debug build installs.

- [ ] **Step 1: Build, sync, install**

```bash
cd mobile && pnpm cap:sync && cd android && ./gradlew assembleDebug -q
adb -s 88d7dd1 install -r app/build/outputs/apk/debug/app-debug.apk
```

- [ ] **Step 2: Verify the flows**

With `adb -s 88d7dd1 logcat -s ShareIntent` running:
- **Route, signed in:** sign in to Strava in the app; from the Strava app share a route → Export GPX → app opens the route detail (map + Download GPX). Save works.
- **Activity, signed in:** share an activity → opens the activity detail.
- **Signed out:** sign out; share a route → app opens the login screen; sign in with Strava → the shared route opens automatically.
- Confirm logcat shows `window.location.hash='share=strava:route-...'` / `activity-...` and no `branch resolve failed`.

- [ ] **Step 3: Changelog + commit**

Add under `## [Unreleased]` → `### Added` in `mobile/CHANGELOG.md`:

```markdown
- **Share from Strava.** In the Strava app, tap Share → Export GPX on any
  activity or route — it opens here ready to save. Works signed out too: it
  opens right after you sign in to Strava.
```

```bash
git add mobile/CHANGELOG.md
git commit -m "docs(mobile): changelog — share from Strava"
```

---

## Notes

- No manifest change (the existing `ACTION_SEND text/plain` filter already puts us in Strava's share sheet).
- No version bump / AAB until an explicit "release".
- If the on-device test shows a branch-link `Location` shape the regex misses, widen `STRAVA_DIRECT` against the captured value — do not guess.
