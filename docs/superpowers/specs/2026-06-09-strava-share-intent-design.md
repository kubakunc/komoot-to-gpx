# Strava share-intent — design

**Date:** 2026-06-09
**Status:** Approved (brainstorming) — ready for implementation plan
**App:** Export GPX for Komoot, Strava (Android, Capacitor 6 + SvelteKit/Svelte 5)
**Builds on:** the Komoot share-intent (`docs/superpowers/specs/2026-05-11-share-intent-design.md`) and the multi-provider work. This is the deferred follow-up from `2026-06-09-strava-provider-design.md` §10.

## Goal

From the Strava app, **Share → Export GPX** opens the shared activity or route
in our app, ready to export as GPX — exactly like the existing Komoot share.
Covers both **activities** and **routes**.

## Spike findings (verified on a real device, 2026-06-09)

Strava's share sends `text/plain` containing a **Branch deep link**
`https://strava.app.link/<code>` — never a plain id. Two shapes seen:
- Route: `"Zobacz tę trasę na Strava: https://strava.app.link/<code> — <name>"`
- Activity: bare `https://strava.app.link/<code>`

Resolving the branch link with a single HTTP request (no redirect-following),
reading the `Location` header, gives the canonical id. Two `Location` shapes
observed — handle both:
- Direct: `Location: https://www.strava.com/activities/<id>?utm_...`
- Intent: `Location: intent://...;S.browser_fallback_url=https%3A%2F%2Fwww.strava.com%2Froutes%2F<id>%3F...;...`

So: **URL-decode the whole `Location` value, then regex
`strava\.com/(activities|routes)/(\d+)`** — it matches both shapes.

Our app already declares an `ACTION_SEND` `text/plain` intent filter on
`MainActivity`, so it already appears in Strava's share sheet — **no manifest
change needed**.

## 1. Native — generalize `MainActivity.handleShareIntent`

Today it regex-matches a Komoot tour URL in the shared text and injects
`window.location.hash='share-tour=<id>'`. Generalize to a provider-aware,
optionally-resolving handler:

1. From the shared text, find the first URL matching any of:
   - Komoot tour (existing `TOUR_PATTERN`),
   - direct Strava `strava\.com/(activities|routes)/(\d+)`,
   - Strava branch link `https?://strava\.app\.link/[A-Za-z0-9]+`.
2. Build a `share=<provider>:<id>` token:
   - Komoot → `komoot:<id>` (plain numeric id).
   - Strava direct → `strava:activity-<id>` / `strava:route-<id>` (namespaced id,
     matching `strava-id.ts`).
   - Strava branch link → **resolve on a background thread**: one
     `HttpsURLConnection` GET with `instanceFollowRedirects = false` + a browser
     UA; read the `Location` header; URL-decode it; regex
     `strava\.com/(activities|routes)/(\d+)` → `strava:<type>-<id>`. On any
     failure (no match, network error) log and return without injecting (graceful
     no-op).
3. Inject `window.location.hash='share=<provider>:<id>'` via
   `bridge.getWebView().post(() -> evaluateJavascript(...))`. For the branch-link
   case this happens after the background resolution completes.

Cold start (app launched by the share) and warm start both work: the hash is set
on `window.location`; the web layer reads it on boot (`onMount`) and via the
`hashchange` listener.

A small helper (e.g. `ShareLinks` static methods or inline) keeps the regexes and
the branch-resolution in one place. Network stays off the main thread.

## 2. Web — generalize `share-intent.ts` + `+layout.svelte`

- `readShareHash(hash)` parses `#share=<provider>:<id>` → `{ provider, id }`.
  Keep a fallback for the legacy `#share-tour=<id>` → `{ provider: 'komoot', id }`
  (harmless, and covers an old cached hash).
- `+layout.handleShareHash`:
  - `setActiveProvider(provider)`.
  - `track(SHARE_INTENT_RECEIVED, { provider, signed_in })`.
  - `markViaShare(id)`.
  - If `getProviderSession(provider)` exists → `goto('/tour/' + id)`.
  - Else → `setPendingShare({ provider, id })` + `goto('/login')`.
- **Pending share becomes provider-aware:** `setPendingShare({provider,id})` /
  `consumePendingShare()` returns `{provider,id} | null`. The login page, after a
  successful sign-in to provider X, consumes the pending share only if
  `pending.provider === X`, then `goto('/tour/' + pending.id)`; otherwise it
  goes to `/`.
- `markViaShare(id)` / `wasViaShare(id)` are unchanged — they already key on the
  (now namespaced for Strava) id, and the detail page checks `wasViaShare(meta.id)`.
- `/tour/<id>` already handles namespaced Strava ids (`route-`/`activity-`) via
  `StravaProvider.getActivity` → no routing change.

## 3. Components / files

- Modify: `mobile/android/.../MainActivity.java` — generalized share handler +
  branch resolver (background thread).
- Modify: `mobile/src/lib/client/share-intent.ts` — `readShareHash` returns
  `{provider,id}`; provider-aware pending; export a `ShareTarget` type.
- Modify: `mobile/src/routes/+layout.svelte` — provider-aware `handleShareHash`.
- Modify: `mobile/src/routes/login/+page.svelte` — consume provider-aware pending
  after sign-in to the matching provider.

## 4. Testing

- **Vitest (pure):** `readShareHash` for `#share=komoot:456`,
  `#share=strava:route-123`, `#share=strava:activity-9`, the legacy
  `#share-tour=456`, and malformed input → null. Provider-aware
  `setPendingShare`/`consumePendingShare` round-trip + clear. `markViaShare` /
  `wasViaShare` with a namespaced id.
- **Native branch resolution + the real share flow:** on-device (the phone is
  connected). Verify: share an activity and a route from the Strava app → app
  opens the detail ready to export; works signed-out (lands after Strava login)
  and signed-in.

## 5. Out of scope (lean)

- No manifest change (the `text/plain` share filter already covers Strava).
- No custom URL scheme / App Links / Branch SDK — we only resolve the public
  redirect.
- No sharing FROM our app.
- No handling of Strava links that are neither activity nor route (segments,
  clubs, profiles) — ignored gracefully.

## 6. Sequencing

1. Web parser + pending generalization (pure, unit-tested) — safe first.
2. `+layout` / login wiring to the provider-aware share.
3. Native generalized handler + branch resolver.
4. On-device verification of the real Strava share (activity + route, signed-in
   and signed-out).

No version bump / AAB until an explicit "release".
