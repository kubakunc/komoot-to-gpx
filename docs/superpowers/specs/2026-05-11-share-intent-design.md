# Share-from-Komoot intent — design spec

**Date:** 2026-05-11
**Status:** approved
**Scope:** Android only (v1, matches Play Store launch scope)

## Problem

Today a user who wants to export a tour from Komoot must: open our app → wait for tour list → scroll to find it → tap → tap GPX. If they were just looking at the tour in the Komoot app, that's 4 unnecessary steps. Komoot's own Share button is the natural entry point.

## Goal

From the Komoot app: tap Share → pick "Export GPX for Komoot" → land directly on the tour detail screen in our app, one tap from GPX export.

## Non-goals (v1)

- Deep links from arbitrary komoot.com URLs in browser/messenger (chosen out: Q1 = A)
- Auto-export bypassing the detail screen (chosen out: Q2 = A)
- Public tours from other users via share_token (covered by future iteration)
- iOS
- Short URLs (`komoot.com/s/...`) — handle later if Komoot uses them
- TTL on pending-share-tour (YAGNI; add if a user reports confusion)

## Architecture

Approach **A** (chosen): native Intent handling in `MainActivity`, deep-link to a Svelte route via URL hash.

### Components

| File | Responsibility | LOC |
|---|---|---|
| `mobile/android/app/src/main/AndroidManifest.xml` | Register intent-filter for ACTION_SEND text/plain | ~5 |
| `mobile/android/app/src/main/java/com/velologiclabs/gpxexporter/MainActivity.kt` | Parse incoming intent, extract tour ID, push to WebView | ~30 |
| `mobile/src/lib/client/share-intent.ts` | Pure functions: `extractTourId(text)`, `consumePendingShare()` — testable | ~25 |
| `mobile/src/routes/+layout.svelte` | Mount-time + `hashchange` listener; route based on session | ~20 |
| `mobile/src/routes/login/+page.svelte` | After successful login, prefer pending tour over default `/` | ~5 |

Each unit has one responsibility. URL parsing lives in pure TS so it can be unit-tested without Android or DOM.

### Data flow

```
1. User: Komoot app → Share → "Export GPX for Komoot"
2. Android delivers Intent(ACTION_SEND, type=text/plain, EXTRA_TEXT=...)
3. MainActivity.handleShareIntent(intent):
     - text = intent.getStringExtra(EXTRA_TEXT)
     - tourId = extractTourId(text)   // Kotlin regex
     - if null: return (no-op, normal launch)
     - bridge.webView.post {
         evaluateJavascript("location.hash='share-tour=$tourId'")
       }
4. Svelte +layout.svelte: onMount + hashchange listener
     - if hash matches /^#share-tour=(\d+)$/:
         clear hash
         if session exists: goto(`/tour/${id}`)
         else: localStorage['pending-share-tour'] = id; goto('/login')
5. login/+page.svelte: after successful sign-in
     - pending = consumePendingShare()   // reads + removes localStorage entry
     - if pending: goto(`/tour/${pending}`)
     - else: goto('/')
```

### URL parsing

Komoot share button typically passes one of:
- `https://www.komoot.com/tour/12345678`
- `https://www.komoot.de/tour/12345678`
- `Check out my tour: https://www.komoot.com/tour/12345678`

Single regex: `/komoot\.(?:com|de)\/tour\/(\d+)/i`. We match the *first* tour URL in the text. Anything else (no URL, non-tour URL, short URL) → no match → silent ignore.

Identical regex used in Kotlin (MainActivity) and TypeScript (share-intent.ts) — keep them in sync; covered by manual smoke test list below.

### Intent filter

```xml
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="text/plain" />
</intent-filter>
```

Goes inside the `MainActivity` declaration, alongside the existing LAUNCHER filter.

`MainActivity` is already `launchMode="singleTask"` and `exported="true"`, which is what we want for `onNewIntent` delivery and external invocation.

## Edge cases

| Situation | Handling |
|---|---|
| Cold start (app not running) | `onCreate` sees intent. `bridge.webView.post {}` defers JS until WebView is ready. |
| Hot start (app already open) | `singleTask` + `onNewIntent` re-uses MainActivity. JS `hashchange` event navigates. |
| Multiple shares in a row | Each `onNewIntent` sets a fresh hash → listener fires per share. |
| EXTRA_TEXT contains no tour URL | Regex returns null. App launches normally to current route. |
| Tour ID not on user's account | KomootApi returns 404 → existing `tour/[id]` page already shows "Failed to load tour." |
| Session expired (401) during load | Existing 401 handling in `tour/[id]` clears session and redirects to `/login`. The pending tour ID can be set again from MainActivity if user re-shares; we do NOT save it as pending in the 401 case (avoid surprise navigation later). |
| User shares before installing/login | localStorage `pending-share-tour` is set, login flow redirects after sign-in. |
| User cancels mid-flow (e.g. closes WebView during login) | localStorage entry stays. Next successful login navigates them to the tour. Acceptable for v1. |

## Testing

### Automated (Vitest)

`mobile/tests/unit/share-intent.test.ts` — covers pure functions:
- `extractTourId` parses `www.komoot.com/tour/12345` → `'12345'`
- `extractTourId` parses `komoot.de/tour/9876` → `'9876'`
- `extractTourId` parses text with surrounding noise: `"Hey check https://komoot.com/tour/42 :)"` → `'42'`
- `extractTourId` returns `null` for non-Komoot URLs
- `extractTourId` returns `null` for Komoot non-tour URLs (collections, users)
- `extractTourId` returns `null` for empty string
- `consumePendingShare` returns + clears the localStorage entry
- `consumePendingShare` returns `null` when nothing pending

### Manual smoke test (on phone)

1. **Happy path, logged in:** open Komoot app, pick a private tour, Share → Export GPX → expect: detail screen with the right tour loaded.
2. **Happy path, logged out:** sign out in our app, then share from Komoot → expect: login screen. After login → detail screen with the right tour.
3. **Hot start:** open our app on list view, switch to Komoot, share → expect: detail screen replaces list view, no app restart.
4. **No tour URL:** share plain text from a notes app → expect: app opens normally, no crash, no error toast.
5. **Tour not on your account (rare):** share another user's public tour URL via clipboard → expect: detail screen attempts load, shows "Failed to load tour" (existing behavior).

## Out of scope (re-stated)

These are deliberate non-goals for v1; reconsider after we ship and see usage:

- ACTION_VIEW intent filter for raw komoot.com URLs in browsers — adds noise to "Open with..." prompts
- Public tour fetch without auth — would let logged-out users export any public tour, requires API exploration
- Auto-pick last save location (skip native picker) — would conflict with users who want different folders
- iOS Universal Links / Share Extension — only when iOS build exists

## Versioning

Bump `versionCode` 1 → 2, `versionName` "1.0" → "1.1" before publishing. First release that ships this feature.
