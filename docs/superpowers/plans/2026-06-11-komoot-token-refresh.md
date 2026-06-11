# Komoot Token Refresh + Cookie Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Komoot users signed in as long as their refresh cookie is valid by refreshing the access JWT natively on 401, and stop each provider's login from wiping the other's cookies.

**Architecture:** `KomootApiPlugin.get` detects a 401, does a single-flight page GET to `www.komoot.com` (twin technique) that rotates the `koa_at` cookie, copies the `Set-Cookie` headers into the WebView `CookieManager`, extracts the fresh JWT, retries, and returns it as `newToken`. The JS layer mutates the in-flight auth object and persists the new token. A shared `CookieUtil.clearFor` replaces the blanket `removeAllCookies` so logins/sign-out only touch their own domain.

**Tech Stack:** Kotlin (Capacitor plugin + WebView CookieManager + HttpsURLConnection), Svelte 5 / TypeScript, Vitest.

---

### Task 1: Per-domain cookie clearing (shared util + both login activities)

**Files:**
- Create: `mobile/android/app/src/main/java/com/velologiclabs/gpxexporter/CookieUtil.kt`
- Modify: `mobile/android/app/src/main/java/com/velologiclabs/gpxexporter/LoginActivity.kt:43-50`
- Modify: `mobile/android/app/src/main/java/com/velologiclabs/gpxexporter/StravaLoginActivity.kt` (the `cm.removeAllCookies(null)` block in `onCreate`)

- [ ] **Step 1: Create the shared cookie util**

```kotlin
package com.velologiclabs.gpxexporter

import android.webkit.CookieManager

/** Cookie helpers that operate on a single provider's domain, so signing in to
 *  one provider never wipes the other's session (CookieManager has no
 *  per-domain clear, so we expire each cookie name by name). */
object CookieUtil {
    /**
     * Expire every cookie currently set for [url]. [domain] is the registrable
     * domain (e.g. ".komoot.com"); we write both a host-scoped and a
     * domain-scoped expiry because a host-only overwrite leaves domain cookies.
     */
    fun clearFor(url: String, domain: String) {
        val cm = CookieManager.getInstance()
        val raw = cm.getCookie(url) ?: return
        val names = raw.split(";").mapNotNull { it.substringBefore("=").trim().takeIf(String::isNotEmpty) }
        val expiry = "Thu, 01 Jan 1970 00:00:00 GMT"
        for (name in names) {
            cm.setCookie(url, "$name=; Path=/; Expires=$expiry")
            cm.setCookie(url, "$name=; Domain=$domain; Path=/; Expires=$expiry")
        }
        cm.flush()
    }
}
```

- [ ] **Step 2: Use it in LoginActivity (Komoot) — replace the blanket clear**

In `LoginActivity.onCreate`, replace:

```kotlin
        cm.setAcceptCookie(true)
        cm.setAcceptThirdPartyCookies(webView, true)
        cm.removeAllCookies(null)
        cm.flush()
```

with:

```kotlin
        cm.setAcceptCookie(true)
        cm.setAcceptThirdPartyCookies(webView, true)
        // Clear only Komoot's cookies — must not wipe a connected Strava session.
        CookieUtil.clearFor(COOKIE_DOMAIN, ".komoot.com")
```

(`COOKIE_DOMAIN` is already `https://www.komoot.com`.)

- [ ] **Step 3: Use it in StravaLoginActivity — replace the blanket clear**

In `StravaLoginActivity.onCreate`, replace the equivalent block:

```kotlin
        cm.setAcceptCookie(true)
        cm.setAcceptThirdPartyCookies(webView, true)
        cm.removeAllCookies(null)
        cm.flush()
```

with:

```kotlin
        cm.setAcceptCookie(true)
        cm.setAcceptThirdPartyCookies(webView, true)
        // Clear only Strava's cookies — must not wipe a connected Komoot session.
        CookieUtil.clearFor(COOKIE_DOMAIN, ".strava.com")
```

(`COOKIE_DOMAIN` in StravaLoginActivity is already `https://www.strava.com`.)

- [ ] **Step 4: Build to verify it compiles**

Run: `cd mobile/android && ./gradlew assembleDebug`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 5: Commit**

```bash
git add mobile/android/app/src/main/java/com/velologiclabs/gpxexporter/CookieUtil.kt \
  mobile/android/app/src/main/java/com/velologiclabs/gpxexporter/LoginActivity.kt \
  mobile/android/app/src/main/java/com/velologiclabs/gpxexporter/StravaLoginActivity.kt
git commit -m "fix(mobile): clear only the signing-in provider's cookies"
```

---

### Task 2: `logout()` on both auth plugins + `Provider.logout` + Sign out

**Files:**
- Modify: `mobile/android/app/src/main/java/com/velologiclabs/gpxexporter/KomootAuthPlugin.kt`
- Modify: `mobile/android/app/src/main/java/com/velologiclabs/gpxexporter/StravaAuthPlugin.kt`
- Modify: `mobile/src/lib/client/komoot-auth.ts`
- Modify: `mobile/src/lib/client/strava-auth.ts`
- Modify: `mobile/src/lib/client/provider.ts:50-61` (Provider interface)
- Modify: `mobile/src/lib/client/providers/komoot.ts`
- Modify: `mobile/src/lib/client/providers/strava.ts`
- Modify: `mobile/src/lib/client/SourceMenu.svelte:69-73`

- [ ] **Step 1: Add `logout` to KomootAuthPlugin**

Add this method inside `KomootAuthPlugin`:

```kotlin
    @PluginMethod
    fun logout(call: PluginCall) {
        CookieUtil.clearFor("https://www.komoot.com", ".komoot.com")
        call.resolve()
    }
```

- [ ] **Step 2: Add `logout` to StravaAuthPlugin**

Add this method inside `StravaAuthPlugin`:

```kotlin
    @PluginMethod
    fun logout(call: PluginCall) {
        CookieUtil.clearFor("https://www.strava.com", ".strava.com")
        call.resolve()
    }
```

- [ ] **Step 3: Expose `logout` from the JS auth bridges**

In `mobile/src/lib/client/komoot-auth.ts`, extend the plugin interface and export a `nativeLogout`:

```typescript
interface KomootAuthPlugin {
  login(): Promise<NativeLoginResult>;
  logout(): Promise<void>;
}

const KomootAuth = registerPlugin<KomootAuthPlugin>('KomootAuth');

export async function nativeLogout(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await KomootAuth.logout();
  } catch {
    /* best effort — Preferences are cleared regardless */
  }
}
```

In `mobile/src/lib/client/strava-auth.ts`, the same:

```typescript
interface StravaAuthPlugin {
  login(): Promise<NativeStravaLoginResult>;
  logout(): Promise<void>;
}

const StravaAuth = registerPlugin<StravaAuthPlugin>('StravaAuth');

export async function nativeLogout(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await StravaAuth.logout();
  } catch {
    /* best effort — Preferences are cleared regardless */
  }
}
```

- [ ] **Step 4: Add optional `logout` to the Provider interface**

In `mobile/src/lib/client/provider.ts`, add to the `Provider` interface (after `getGpx`):

```typescript
  getGpx(session: ProviderSession, id: string): Promise<string>;
  /** Clear native session state (cookies) for this provider, if any. */
  logout?(): Promise<void>;
```

- [ ] **Step 5: Implement `logout` in both providers**

In `mobile/src/lib/client/providers/komoot.ts`, import and wire it:

```typescript
import { nativeLogin, nativeLogout } from '../komoot-auth';
```

and add to the `komootProvider` object:

```typescript
  async logout(): Promise<void> {
    await nativeLogout();
  },
```

In `mobile/src/lib/client/providers/strava.ts`, import `nativeLogout` from `../strava-auth` and add the identical `logout` method to `stravaProvider`.

- [ ] **Step 6: Call provider.logout from Sign out**

In `mobile/src/lib/client/SourceMenu.svelte`, replace `signOut`:

```svelte
  async function signOut() {
    open = false;
    for (const p of await getConnectedProviders()) {
      await getProvider(p).logout?.();
      await clearProviderSession(p);
    }
    onSignedOut();
  }
```

- [ ] **Step 7: Type-check + build**

Run: `cd mobile && pnpm check && cd android && ./gradlew assembleDebug`
Expected: `0 ERRORS`, `BUILD SUCCESSFUL`.

- [ ] **Step 8: Commit**

```bash
git add mobile/android/app/src/main/java/com/velologiclabs/gpxexporter/KomootAuthPlugin.kt \
  mobile/android/app/src/main/java/com/velologiclabs/gpxexporter/StravaAuthPlugin.kt \
  mobile/src/lib/client/komoot-auth.ts mobile/src/lib/client/strava-auth.ts \
  mobile/src/lib/client/provider.ts mobile/src/lib/client/providers/komoot.ts \
  mobile/src/lib/client/providers/strava.ts mobile/src/lib/client/SourceMenu.svelte
git commit -m "feat(mobile): clear provider cookies on sign out"
```

---

### Task 3: Native token refresh in KomootApiPlugin

**Files:**
- Modify: `mobile/android/app/src/main/java/com/velologiclabs/gpxexporter/KomootApiPlugin.kt`

- [ ] **Step 1: Rewrite KomootApiPlugin with single-flight refresh**

Replace the whole file with:

```kotlin
package com.velologiclabs.gpxexporter

import android.util.Log
import android.webkit.CookieManager
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.net.URL
import java.net.URLDecoder
import javax.net.ssl.HttpsURLConnection

@CapacitorPlugin(name = "KomootApi")
class KomootApiPlugin : Plugin() {

    companion object {
        private const val BASE = "https://api.komoot.de"
        private const val PAGE = "https://www.komoot.com/"
        private const val COOKIE_DOMAIN = "https://www.komoot.com"
        private const val UA = "ExportGpxForKomoot/0.1"
        private val refreshLock = Any()
    }

    @PluginMethod
    fun get(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("path required")
        val token = call.getString("token") ?: return call.reject("token required")
        Thread {
            try {
                var (status, body) = httpGet("$BASE$path", token)
                var newToken: String? = null
                if (status == 401) {
                    val refreshed = refreshToken(token)
                    if (refreshed != null) {
                        newToken = refreshed
                        val retry = httpGet("$BASE$path", refreshed)
                        status = retry.first; body = retry.second
                    }
                }
                val ret = JSObject()
                ret.put("status", status)
                ret.put("body", body)
                if (newToken != null) ret.put("newToken", newToken)
                call.resolve(ret)
            } catch (e: Exception) {
                Log.e("KomootApi", "GET $path failed", e)
                call.reject(e.message ?: "request failed")
            }
        }.start()
    }

    /**
     * Twin-technique refresh: a page GET to www.komoot.com with the current
     * cookie jar makes Komoot's SSR rotate the koa_at cookie via Set-Cookie.
     * Copy those cookies into the WebView CookieManager and read the new JWT.
     * Single-flight so concurrent 401s share one refresh. Returns the new JWT,
     * or null if no fresh koa_at appeared (caller surfaces the original 401).
     */
    private fun refreshToken(staleToken: String): String? = synchronized(refreshLock) {
        // Another thread may have refreshed while we waited on the lock.
        currentJwt()?.let { if (it != staleToken) return it }
        return try {
            val conn = URL(PAGE).openConnection() as HttpsURLConnection
            conn.requestMethod = "GET"
            conn.instanceFollowRedirects = true
            conn.setRequestProperty("Cookie", CookieManager.getInstance().getCookie(COOKIE_DOMAIN) ?: "")
            conn.setRequestProperty("User-Agent", UA)
            conn.connectTimeout = 12_000
            conn.readTimeout = 15_000
            conn.responseCode
            val cm = CookieManager.getInstance()
            // copy every Set-Cookie back into the jar
            conn.headerFields["Set-Cookie"]?.forEach { cm.setCookie(COOKIE_DOMAIN, it) }
            conn.headerFields["set-cookie"]?.forEach { cm.setCookie(COOKIE_DOMAIN, it) }
            cm.flush()
            conn.disconnect()
            val jwt = currentJwt()
            Log.d("KomootApi", "refresh: new koa_at present=${jwt != null} changed=${jwt != null && jwt != staleToken}")
            if (jwt != null && jwt != staleToken) jwt else null
        } catch (e: Exception) {
            Log.w("KomootApi", "refresh failed: ${e.message}")
            null
        }
    }

    /** Extract the JWT (2nd field of koa_at = userId|JWT|expiry, URL-decoded). */
    private fun currentJwt(): String? {
        val cookies = CookieManager.getInstance().getCookie(COOKIE_DOMAIN) ?: return null
        val koaAt = cookies.split(";").map { it.trim() }
            .firstOrNull { it.startsWith("koa_at=") }
            ?.substringAfter("koa_at=")
            ?.let { runCatching { URLDecoder.decode(it, "UTF-8") }.getOrNull() }
            ?: return null
        val parts = koaAt.split("|")
        return if (parts.size >= 2 && parts[1].isNotBlank()) parts[1] else null
    }

    private fun httpGet(url: String, token: String): Pair<Int, String> {
        val conn = URL(url).openConnection() as HttpsURLConnection
        conn.requestMethod = "GET"
        conn.setRequestProperty("Authorization", "Bearer $token")
        conn.setRequestProperty("Accept", "application/hal+json,application/json")
        conn.setRequestProperty("User-Agent", UA)
        conn.connectTimeout = 15_000
        conn.readTimeout = 30_000
        return try {
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
            Log.d("KomootApi", "GET $url -> $code (${body.length} bytes)")
            Pair(code, body)
        } finally {
            conn.disconnect()
        }
    }
}
```

- [ ] **Step 2: Build to verify it compiles**

Run: `cd mobile/android && ./gradlew assembleDebug`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 3: Commit**

```bash
git add mobile/android/app/src/main/java/com/velologiclabs/gpxexporter/KomootApiPlugin.kt
git commit -m "feat(mobile): refresh Komoot token on 401 via cookie jar"
```

---

### Task 4: JS propagation of the refreshed token

**Files:**
- Modify: `mobile/src/lib/client/komoot.ts:3-37` (plugin type, apiGet, hook)
- Modify: `mobile/src/lib/client/providers/komoot.ts` (register hook)
- Test: `mobile/tests/unit/komoot.test.ts`

- [ ] **Step 1: Write the failing test for token propagation**

Add to `mobile/tests/unit/komoot.test.ts`:

```typescript
import { listTours, getTour, getCoordinates, KomootError, onTokenRefreshed } from '../../src/lib/client/komoot';

describe('komoot token refresh propagation', () => {
  beforeEach(() => mockGet.mockReset());

  it('mutates the auth object and fires the hook when newToken is returned', async () => {
    const refreshed: string[] = [];
    onTokenRefreshed((t) => refreshed.push(t));
    mockGet.mockResolvedValueOnce({ status: 200, body: fixture('tours-page.json'), newToken: 'FRESH' });

    const auth = { email: 'a@b.c', token: 'STALE' };
    await listTours(auth, { userId: '1', page: 0 });

    expect(auth.token).toBe('FRESH');
    expect(refreshed).toEqual(['FRESH']);
    onTokenRefreshed(null);
  });

  it('does not fire the hook when no newToken is returned', async () => {
    const refreshed: string[] = [];
    onTokenRefreshed((t) => refreshed.push(t));
    mockGet.mockResolvedValueOnce({ status: 200, body: fixture('tours-page.json') });

    const auth = { email: 'a@b.c', token: 'STALE' };
    await listTours(auth, { userId: '1', page: 0 });

    expect(auth.token).toBe('STALE');
    expect(refreshed).toEqual([]);
    onTokenRefreshed(null);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile && pnpm test -- komoot.test.ts`
Expected: FAIL — `onTokenRefreshed` is not exported.

- [ ] **Step 3: Implement the auth-object apiGet + hook**

In `mobile/src/lib/client/komoot.ts`, replace the plugin interface, registration and `apiGet`:

```typescript
import { registerPlugin } from '@capacitor/core';

interface KomootApiPlugin {
  get(opts: { path: string; token: string }): Promise<{ status: number; body: string; newToken?: string }>;
}

const KomootApi = registerPlugin<KomootApiPlugin>('KomootApi');

export class KomootError extends Error {
  readonly name = 'KomootError';
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export interface KomootAuth {
  email: string;
  token: string;
}

type TokenHook = (token: string) => void;
let tokenHook: TokenHook | null = null;
/** Register (or clear, with null) a callback fired when the native layer
 *  refreshes the Komoot token. The provider uses it to persist the session. */
export function onTokenRefreshed(hook: TokenHook | null): void {
  tokenHook = hook;
}

async function apiGet<T>(path: string, auth: KomootAuth, label: string): Promise<T> {
  const { status, body, newToken } = await KomootApi.get({ path, token: auth.token });
  if (newToken && newToken !== auth.token) {
    auth.token = newToken; // reused by the next sequential call (no second refresh)
    tokenHook?.(newToken);
  }
  if (status < 200 || status >= 300) {
    const mapped = status >= 500 ? 502 : status;
    throw new KomootError(`${label} failed (komoot returned ${status})`, mapped);
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new KomootError(`${label}: invalid JSON response`, 502);
  }
}
```

- [ ] **Step 4: Update the three call sites to pass `auth`**

In `mobile/src/lib/client/komoot.ts`, change the `apiGet` calls in `listTours`, `getTour`, and `getCoordinates` from passing `auth.token` to passing `auth`:

In `listTours`:
```typescript
  const body = await apiGet<ToursResponse>(
    `/v007/users/${encodeURIComponent(opts.userId)}/tours/?${qs}`,
    auth,
    'listTours'
  );
```

In `getTour`:
```typescript
  const raw = await apiGet<Record<string, unknown>>(
    `/v007/tours/${encodeURIComponent(tourId)}`,
    auth,
    'getTour'
  );
```

In `getCoordinates`:
```typescript
  const body = await apiGet<{ items?: Array<Record<string, unknown>> }>(
    `/v007/tours/${encodeURIComponent(tourId)}/coordinates`,
    auth,
    'getCoordinates'
  );
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd mobile && pnpm test -- komoot.test.ts`
Expected: PASS (all komoot tests, including the two new ones).

- [ ] **Step 6: Register the persist hook in the Komoot provider**

In `mobile/src/lib/client/providers/komoot.ts`, import the hook and session setter and register at module load:

```typescript
import { listTours, getTour, getCoordinates, onTokenRefreshed, type TourSummary, type TourFilter } from '../komoot';
import { setProviderSession } from '../session';
```

After `toSummary` (module top level, before `komootProvider`):

```typescript
let currentSession: ProviderSession | null = null;
onTokenRefreshed((token) => {
  if (currentSession) {
    currentSession = { ...currentSession, token };
    void setProviderSession(currentSession);
  }
});
```

Then in each provider method that builds `auth`, set `currentSession = session` first. In `listActivities`, `getActivity`, and `getGpx`, add as the first line:

```typescript
    currentSession = session;
```

(So the hook persists against the session whose call triggered the refresh.)

- [ ] **Step 7: Type-check + full test run**

Run: `cd mobile && pnpm check && pnpm test`
Expected: `0 ERRORS`; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add mobile/src/lib/client/komoot.ts mobile/src/lib/client/providers/komoot.ts mobile/tests/unit/komoot.test.ts
git commit -m "feat(mobile): propagate and persist refreshed Komoot token"
```

---

### Task 5: On-device validation (spike gate) + cookie-hygiene check

**Files:** none (manual verification). If the spike fails, follow the fallback note below.

- [ ] **Step 1: Build, sync, install on the phone**

Run:
```bash
cd mobile && pnpm cap:sync && cd android && ./gradlew assembleDebug \
  && adb -s 88d7dd1 install -r app/build/outputs/apk/debug/app-debug.apk
```
Expected: `Success`.

- [ ] **Step 2: Cookie-hygiene check (no 35-min wait)**

Ask the user to: sign in to Komoot, then sign in to Strava, then open the
source menu. Both rows must still show as connected. Then dump the cookie
store names:
```bash
adb -s 88d7dd1 shell 'run-as com.velologiclabs.gpxexporter strings /data/data/com.velologiclabs.gpxexporter/app_webview/Default/Cookies' | grep -coiE 'koa_at|koa_re'
```
Expected: `>0` (Komoot cookies survived the Strava login). Before Task 1 this was `0`.

- [ ] **Step 3: Refresh validation (the spike)**

Clear logcat, then have the user sign in to Komoot and leave the app open / reopen the list after ≥35 minutes (JWT TTL is 1800 s), and read:
```bash
adb -s 88d7dd1 logcat -d | grep -iE 'KomootApi: refresh'
```
Expected: `refresh: new koa_at present=true changed=true`, and the list loads
without bouncing to /login.

- [ ] **Step 4: Sign-out cookie check (review #7)**

Have the user tap Sign out, then:
```bash
adb -s 88d7dd1 shell 'run-as com.velologiclabs.gpxexporter strings /data/data/com.velologiclabs.gpxexporter/app_webview/Default/Cookies' | grep -coiE 'koa_at|koa_re|strava_remember'
```
Expected: `0`.

- [ ] **Step 5: Fallback if Step 3 shows `changed=false`**

If the page GET does not rotate `koa_at`, switch `refreshToken`'s internals to
a hidden WebView (keep the method signature and everything else). Replace the
`HttpsURLConnection` block with: on the main thread, create an offscreen
`WebView`, `loadUrl("https://www.komoot.com/")`, wait for `onPageFinished`
(with a CountDownLatch + ~15 s timeout), then read `currentJwt()` from the
CookieManager and destroy the WebView. The JS contract and Tasks 1, 2, 4 are
unchanged.

- [ ] **Step 6: Update CHANGELOG**

Add under a fresh `## [Unreleased]` in `mobile/CHANGELOG.md`:

```markdown
## [Unreleased]

### Fixed
- You now stay signed in to Komoot — the app refreshes your session
  automatically instead of asking you to sign in again after a while.
- Signing in to one of Komoot/Strava no longer signs you out of the other.
- Sign out now fully clears the in-app browser session for both services.
```

Commit:
```bash
git add mobile/CHANGELOG.md
git commit -m "docs(mobile): changelog for Komoot session refresh"
```
