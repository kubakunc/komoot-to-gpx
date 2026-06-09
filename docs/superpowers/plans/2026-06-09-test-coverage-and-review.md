# Test Coverage + Whole-Code Review + CI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app lean and stable — fix the 2 pre-existing type errors, extract bug-prone logic from components into tested pure helpers, add unit tests for the Strava client/provider, wire CI, and run a whole-code review with fixes.

**Architecture:** Test pure logic, not the framework. Extract the reconcile/filename/auth-error logic out of Svelte components into pure functions and unit-test them (no jsdom/component harness). Mock the Capacitor bridge for client tests. CI runs `pnpm test` + `pnpm check` on GitHub Actions.

**Tech Stack:** SvelteKit 2 + Svelte 5, TypeScript, Vitest (node env), GitHub Actions. Spec: `docs/superpowers/specs/2026-06-09-test-coverage-and-review-design.md`.

**Working directory:** `mobile/` for all `pnpm`/test commands.

**Green bar:** `pnpm check` must end with **0 errors** after Task 1 (the 2 pre-existing errors are fixed there). `pnpm test` always all-pass.

---

### Task 1: Fix the two pre-existing type errors

**Files:**
- Modify: `mobile/src/lib/client/analytics.ts`
- Modify: `mobile/src/lib/client/MiniMap.svelte`

- [ ] **Step 1: See the errors**

Run: `pnpm check`
Expected: 2 ERRORS — `analytics.ts:55` (`ConsentType` used as a type) and `MiniMap.svelte:29` (`tap` not in `MapOptions`).

- [ ] **Step 2: Fix analytics.ts**

In `mobile/src/lib/client/analytics.ts`, the `set` helper types its param as the value `ConsentType`. Change the annotation to the type position. Replace:

```ts
    const set = (type: ConsentType, ok: boolean) =>
```

with:

```ts
    const set = (type: (typeof ConsentType)[keyof typeof ConsentType], ok: boolean) =>
```

- [ ] **Step 3: Fix MiniMap.svelte**

In `mobile/src/lib/client/MiniMap.svelte` around line 29, the Leaflet map options object includes `tap: false`, which isn't a valid `MapOptions` key in current `@types/leaflet`. Remove the `tap` property from the options object (it is a no-op on modern Leaflet). Find the `L.map(...)` options object and delete the `tap: false,` entry.

- [ ] **Step 4: Verify green**

Run: `pnpm check`
Expected: `0 ERRORS`. Then `pnpm test` → all pass.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/lib/client/analytics.ts mobile/src/lib/client/MiniMap.svelte
git commit -m "fix(mobile): resolve the two pre-existing type-check errors"
```

---

### Task 2: Extract + test `gpxFilename`

`safeName(...) + '.gpx'` is duplicated in `+page.svelte` and `tour/[id]/+page.svelte`. Extract to one tested helper.

**Files:**
- Create: `mobile/src/lib/client/gpx-filename.ts`
- Test: `mobile/tests/unit/gpx-filename.test.ts`
- Modify: `mobile/src/routes/+page.svelte`, `mobile/src/routes/tour/[id]/+page.svelte`

- [ ] **Step 1: Write the failing test**

Create `mobile/tests/unit/gpx-filename.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { gpxFilename } from '../../src/lib/client/gpx-filename';

describe('gpxFilename', () => {
  it('keeps letters, numbers, spaces→underscores and adds .gpx', () => {
    expect(gpxFilename('Evening Ride')).toBe('Evening_Ride.gpx');
  });
  it('strips punctuation but keeps unicode letters', () => {
    expect(gpxFilename('zalew zegrzyński!')).toBe('zalew_zegrzyński.gpx');
  });
  it('falls back to tour.gpx when nothing usable remains', () => {
    expect(gpxFilename('***')).toBe('tour.gpx');
    expect(gpxFilename('')).toBe('tour.gpx');
  });
});
```

- [ ] **Step 2: Run it (fails — module missing)**

Run: `pnpm test -- gpx-filename`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `mobile/src/lib/client/gpx-filename.ts`:

```ts
/** Sanitise an activity name into a safe `<name>.gpx` filename. */
export function gpxFilename(name: string): string {
  const base = name.replace(/[^\p{L}\p{N}\-_ ]+/gu, '').trim().replace(/\s+/g, '_') || 'tour';
  return `${base}.gpx`;
}
```

- [ ] **Step 4: Run it (passes)**

Run: `pnpm test -- gpx-filename`
Expected: PASS (3 tests).

- [ ] **Step 5: Use it in both pages**

In `mobile/src/routes/+page.svelte`: add `import { gpxFilename } from '$lib/client/gpx-filename';`, delete the local `safeName` function, and change `const filename = safeName(t.name) + '.gpx';` to `const filename = gpxFilename(t.name);`.

In `mobile/src/routes/tour/[id]/+page.svelte`: add the same import, delete the local `safeName` function, and change `const filename = safeName(meta.name) + '.gpx';` to `const filename = gpxFilename(meta.name);`.

- [ ] **Step 6: Verify + commit**

Run: `pnpm test && pnpm check` (0 errors, all pass).

```bash
git add mobile/src/lib/client/gpx-filename.ts mobile/tests/unit/gpx-filename.test.ts \
        mobile/src/routes/+page.svelte "mobile/src/routes/tour/[id]/+page.svelte"
git commit -m "refactor(mobile): extract + test gpxFilename (was duplicated)"
```

---

### Task 3: Extract + test `isProviderAuthError`

The 401-only auth-fail predicate is duplicated in `+page.svelte` and `tour/[id]/+page.svelte`.

**Files:**
- Create: `mobile/src/lib/client/auth-errors.ts`
- Test: `mobile/tests/unit/auth-errors.test.ts`
- Modify: `mobile/src/routes/+page.svelte`, `mobile/src/routes/tour/[id]/+page.svelte`

- [ ] **Step 1: Write the failing test**

Create `mobile/tests/unit/auth-errors.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({}) }));

import { KomootError } from '../../src/lib/client/komoot';
import { StravaError } from '../../src/lib/client/strava';
import { isProviderAuthError } from '../../src/lib/client/auth-errors';

describe('isProviderAuthError', () => {
  it('is true only for a 401 from either provider', () => {
    expect(isProviderAuthError(new KomootError('x', 401))).toBe(true);
    expect(isProviderAuthError(new StravaError('x', 401))).toBe(true);
  });
  it('is false for 403, 5xx and other statuses (must not sign out)', () => {
    expect(isProviderAuthError(new StravaError('x', 403))).toBe(false);
    expect(isProviderAuthError(new KomootError('x', 502))).toBe(false);
  });
  it('is false for non-provider errors', () => {
    expect(isProviderAuthError(new Error('nope'))).toBe(false);
    expect(isProviderAuthError(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it (fails)**

Run: `pnpm test -- auth-errors`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `mobile/src/lib/client/auth-errors.ts`:

```ts
import { KomootError } from './komoot';
import { StravaError } from './strava';

/**
 * True only for a genuine 401 (expired/invalid session) from either provider.
 * A 403 (permission/CSRF) or any other status must NOT be treated as auth
 * failure — otherwise a routes/CSRF hiccup would sign the user out.
 */
export function isProviderAuthError(e: unknown): boolean {
  return (e instanceof KomootError && e.status === 401) || (e instanceof StravaError && e.status === 401);
}
```

- [ ] **Step 4: Run it (passes)**

Run: `pnpm test -- auth-errors`
Expected: PASS.

- [ ] **Step 5: Use it in both pages**

In `mobile/src/routes/+page.svelte`: add `import { isProviderAuthError } from '$lib/client/auth-errors';`, delete the local `isAuthError` function, and replace both `isAuthError(e)` / `isAuthError(err)` calls with `isProviderAuthError(...)`. Remove the now-unused `StravaError` import if `KomootError` is still used for nothing else — keep `KomootError`/`StravaError` imports only if still referenced; after this change `+page.svelte` no longer references them directly, so drop them from its imports (keep `downsample`, `type Coordinate` from komoot).

In `mobile/src/routes/tour/[id]/+page.svelte`: same import, delete local `isAuthError`, replace calls, and drop the now-unused `KomootError`/`StravaError` imports (keep `type Coordinate`).

- [ ] **Step 6: Verify + commit**

Run: `pnpm test && pnpm check` (0 errors, all pass).

```bash
git add mobile/src/lib/client/auth-errors.ts mobile/tests/unit/auth-errors.test.ts \
        mobile/src/routes/+page.svelte "mobile/src/routes/tour/[id]/+page.svelte"
git commit -m "refactor(mobile): extract + test isProviderAuthError (401-only, was duplicated)"
```

---

### Task 4: Extract + test `resolveActiveProvider`

The active-source reconcile rule (source of the flash/desync bugs) is inline in `+page.svelte` and `+layout.svelte`.

**Files:**
- Modify: `mobile/src/lib/client/active-provider.ts`
- Test: `mobile/tests/unit/active-provider.test.ts`
- Modify: `mobile/src/routes/+page.svelte`, `mobile/src/routes/+layout.svelte`, `mobile/src/routes/tour/[id]/+page.svelte`

- [ ] **Step 1: Add the failing test**

Append to `mobile/tests/unit/active-provider.test.ts`:

```ts
import { resolveActiveProvider } from '../../src/lib/client/active-provider';

describe('resolveActiveProvider', () => {
  it('keeps the requested provider when it is connected', () => {
    expect(resolveActiveProvider(['komoot', 'strava'], 'strava')).toBe('strava');
  });
  it('falls back to the first connected when the requested one is not connected', () => {
    expect(resolveActiveProvider(['strava'], 'komoot')).toBe('strava');
  });
  it('returns the requested provider unchanged when nothing is connected', () => {
    expect(resolveActiveProvider([], 'komoot')).toBe('komoot');
  });
});
```

- [ ] **Step 2: Run it (fails)**

Run: `pnpm test -- active-provider`
Expected: FAIL (`resolveActiveProvider` not exported).

- [ ] **Step 3: Implement**

Append to `mobile/src/lib/client/active-provider.ts`:

```ts
/**
 * The effective active source: the requested one if it's connected, otherwise
 * the first connected provider. When nothing is connected, returns the request
 * unchanged (the caller redirects to /login).
 */
export function resolveActiveProvider(connected: ProviderId[], requested: ProviderId): ProviderId {
  if (connected.length === 0) return requested;
  return connected.includes(requested) ? requested : connected[0];
}
```

- [ ] **Step 4: Run it (passes)**

Run: `pnpm test -- active-provider`
Expected: PASS.

- [ ] **Step 5: Use it in the components**

In `mobile/src/routes/+layout.svelte` `refreshUserLabel`, replace:

```ts
    let active = getActiveProvider();
    if (!connected.includes(active)) { active = connected[0]; setActiveProvider(active); }
```

with:

```ts
    const active = resolveActiveProvider(connected, getActiveProvider());
    if (active !== getActiveProvider()) setActiveProvider(active);
```

and add `resolveActiveProvider` to the `active-provider` import.

In `mobile/src/routes/+page.svelte` `$effect`, replace:

```ts
      let active = id;
      if (connected.length > 0 && !connected.includes(active)) {
        active = connected[0];
        setActiveProvider(active); // re-enters this effect with the corrected id
        return;
      }
```

with:

```ts
      const active = resolveActiveProvider(connected, id);
      if (connected.length > 0 && active !== id) {
        setActiveProvider(active); // re-enters this effect with the corrected id
        return;
      }
```

and add `resolveActiveProvider` to the import.

In `mobile/src/routes/tour/[id]/+page.svelte` `load`, replace:

```ts
    const connected = await getConnectedProviders();
    if (connected.length > 0 && !connected.includes(activeProvider)) {
      activeProvider = connected[0];
      setActiveProvider(activeProvider);
    }
```

with:

```ts
    const connected = await getConnectedProviders();
    const resolved = resolveActiveProvider(connected, activeProvider);
    if (resolved !== activeProvider) { activeProvider = resolved; setActiveProvider(resolved); }
```

and add `resolveActiveProvider` to the import.

- [ ] **Step 6: Verify + commit**

Run: `pnpm test && pnpm check` (0 errors, all pass).

```bash
git add mobile/src/lib/client/active-provider.ts mobile/tests/unit/active-provider.test.ts \
        mobile/src/routes/+layout.svelte mobile/src/routes/+page.svelte "mobile/src/routes/tour/[id]/+page.svelte"
git commit -m "refactor(mobile): extract + test resolveActiveProvider (source reconcile)"
```

---

### Task 5: Tests for the Strava client (`strava.ts`)

Cover the error mapping and request shaping where recent bugs lived. Mock the `StravaApi` plugin.

**Files:**
- Test: `mobile/tests/unit/strava.test.ts`

- [ ] **Step 1: Write the test**

Create `mobile/tests/unit/strava.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGet, mockPost } = vi.hoisted(() => ({ mockGet: vi.fn(), mockPost: vi.fn() }));
vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({ get: mockGet, post: mockPost }) }));

import {
  listActivities, listRoutes, getGpx, getRouteGpx, getStreamCoordinates, getActivityName, StravaError
} from '../../src/lib/client/strava';

beforeEach(() => { mockGet.mockReset(); mockPost.mockReset(); });

describe('strava.listActivities', () => {
  it('requests page+1 and parses the models', async () => {
    mockGet.mockResolvedValueOnce({ status: 200, body: JSON.stringify({ models: [{ id: 9, name: 'R', sport_type: 'Ride' }] }) });
    const out = await listActivities(0, 'activities');
    expect(mockGet).toHaveBeenCalledWith({ path: '/athlete/training_activities?per_page=20&page=1' });
    expect(out.items[0].id).toBe('activity-9');
  });
  it('maps 401 to a StravaError(401)', async () => {
    mockGet.mockResolvedValueOnce({ status: 401, body: '' });
    await expect(listActivities(0, 'activities')).rejects.toMatchObject({ name: 'StravaError', status: 401 });
  });
});

describe('strava.listRoutes', () => {
  it('POSTs the my-routes endpoint and parses nodes', async () => {
    mockPost.mockResolvedValueOnce({ status: 200, body: JSON.stringify({ me: { searchRoutes: { nodes: [{ id: '7', title: 'T', length: 100, routeType: 'Ride' }], pageInfo: { hasNextPage: false } } } }) });
    const out = await listRoutes(0);
    expect(mockPost.mock.calls[0][0].path).toBe('/api/next/data/routes/my-routes');
    expect(out.items[0].id).toBe('route-7');
  });
  it('does NOT treat 403 as auth failure (no 401)', async () => {
    mockPost.mockResolvedValueOnce({ status: 403, body: '' });
    await expect(listRoutes(0)).rejects.toMatchObject({ name: 'StravaError', status: 403 });
  });
  it('maps a real 401 to 401', async () => {
    mockPost.mockResolvedValueOnce({ status: 401, body: '' });
    await expect(listRoutes(0)).rejects.toMatchObject({ status: 401 });
  });
});

describe('strava GPX export', () => {
  it('passes a GPX body through', async () => {
    mockGet.mockResolvedValueOnce({ status: 200, body: '<?xml?><gpx/>' });
    expect(await getGpx('5')).toContain('<gpx');
  });
  it('rejects a non-GPX body as no-track (422)', async () => {
    mockGet.mockResolvedValueOnce({ status: 200, body: 'Not found' });
    await expect(getGpx('5')).rejects.toMatchObject({ status: 422 });
  });
  it('route export hits the routes path', async () => {
    mockGet.mockResolvedValueOnce({ status: 200, body: '<gpx/>' });
    await getRouteGpx('7');
    expect(mockGet).toHaveBeenCalledWith({ path: '/routes/7/export_gpx' });
  });
});

describe('strava streams + name', () => {
  it('returns [] when streams are unavailable', async () => {
    mockGet.mockResolvedValueOnce({ status: 404, body: '' });
    expect(await getStreamCoordinates('5')).toEqual([]);
  });
  it('extracts the activity name from <title>, stripping the suffix', async () => {
    mockGet.mockResolvedValueOnce({ status: 200, body: '<html><head><title>Evening Ride | Strava</title></head></html>' });
    expect(await getActivityName('5')).toBe('Evening Ride');
  });
});

void StravaError;
```

- [ ] **Step 2: Run it**

Run: `pnpm test -- strava.test`
Expected: PASS. If any case fails, it is a real behaviour bug — fix `strava.ts` to match the asserted contract (do not weaken the test).

- [ ] **Step 3: Commit**

```bash
git add mobile/tests/unit/strava.test.ts
git commit -m "test(mobile): cover Strava client error mapping + request shaping"
```

---

### Task 6: Tests for Strava provider routing (`providers/strava.ts`)

Verify the filter routing and the `activity-`/`route-` id dispatch. Mock the `strava.ts` module.

**Files:**
- Test: `mobile/tests/unit/provider-strava.test.ts`

- [ ] **Step 1: Write the test**

Create `mobile/tests/unit/provider-strava.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  listActivities: vi.fn(), listRoutes: vi.fn(),
  getStreamCoordinates: vi.fn(), getActivityName: vi.fn(),
  getGpx: vi.fn(), getRouteDetail: vi.fn(), getRouteGpx: vi.fn()
}));
vi.mock('../../src/lib/client/strava', () => m);
vi.mock('../../src/lib/client/strava-auth', () => ({ nativeStravaLogin: vi.fn() }));

import { stravaProvider } from '../../src/lib/client/providers/strava';
import type { ProviderSession } from '../../src/lib/client/provider';

const s: ProviderSession = { provider: 'strava', userId: '1', displayName: 'A', token: 'web-session' };

beforeEach(() => Object.values(m).forEach((f) => f.mockReset()));

describe('stravaProvider list routing', () => {
  it('routes the "routes" filter to listRoutes', async () => {
    m.listRoutes.mockResolvedValueOnce({ items: [], page: 0, totalPages: 1 });
    await stravaProvider.listActivities(s, { page: 2, filter: 'routes' });
    expect(m.listRoutes).toHaveBeenCalledWith(2);
    expect(m.listActivities).not.toHaveBeenCalled();
  });
  it('routes anything else to listActivities', async () => {
    m.listActivities.mockResolvedValueOnce({ items: [], page: 0, totalPages: 1 });
    await stravaProvider.listActivities(s, { page: 0, filter: 'activities' });
    expect(m.listActivities).toHaveBeenCalledWith(0, 'activities');
  });
});

describe('stravaProvider id dispatch', () => {
  it('getGpx routes a route id to getRouteGpx with the raw id', async () => {
    m.getRouteGpx.mockResolvedValueOnce('<gpx/>');
    await stravaProvider.getGpx(s, 'route-77');
    expect(m.getRouteGpx).toHaveBeenCalledWith('77');
    expect(m.getGpx).not.toHaveBeenCalled();
  });
  it('getGpx routes an activity id to getGpx with the raw id', async () => {
    m.getGpx.mockResolvedValueOnce('<gpx/>');
    await stravaProvider.getGpx(s, 'activity-9');
    expect(m.getGpx).toHaveBeenCalledWith('9');
  });
  it('getActivity for a route parses GPX detail', async () => {
    m.getRouteDetail.mockResolvedValueOnce({ name: 'Loop', coords: [{ lat: 1, lng: 2 }] });
    const d = await stravaProvider.getActivity(s, 'route-77');
    expect(m.getRouteDetail).toHaveBeenCalledWith('77');
    expect(d.meta.name).toBe('Loop');
    expect(d.preview).toEqual([{ lat: 1, lng: 2 }]);
  });
  it('getActivity for an activity uses streams + name', async () => {
    m.getStreamCoordinates.mockResolvedValueOnce([{ lat: 3, lng: 4 }]);
    m.getActivityName.mockResolvedValueOnce('Ride');
    const d = await stravaProvider.getActivity(s, 'activity-9');
    expect(m.getStreamCoordinates).toHaveBeenCalledWith('9');
    expect(d.meta.name).toBe('Ride');
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm test -- provider-strava`
Expected: PASS. A failure means a real routing bug — fix `providers/strava.ts`.

- [ ] **Step 3: Commit**

```bash
git add mobile/tests/unit/provider-strava.test.ts
git commit -m "test(mobile): cover Strava provider filter + id-dispatch routing"
```

---

### Task 7: CI — GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Read the pnpm version**

Run: `grep -E '"packageManager"|"pnpm"' mobile/package.json; cat mobile/../package.json 2>/dev/null | grep packageManager`
Note the pnpm major version if a `packageManager` field exists; otherwise use `9`.

- [ ] **Step 2: Create the workflow**

Create `.github/workflows/ci.yml` (repo root):

```yaml
name: CI
on:
  push:
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: mobile
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
          cache-dependency-path: mobile/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm check
```

If Step 1 found a different pnpm major version, set `version:` to match it.

- [ ] **Step 3: Validate locally**

Run (from `mobile/`): `pnpm install --frozen-lockfile && pnpm test && pnpm check`
Expected: install succeeds with the frozen lockfile, tests pass, `pnpm check` 0 errors. (This is exactly what CI runs.)

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run pnpm test + check on push and PR"
```

---

### Task 8: Whole-code review pass + fixes

Not a TDD task — run the review tooling, triage, fix only real findings, keep the tests green. Do this last so the review sees the cleaned-up, tested code.

**Files:** any flagged by the review (fixes only).

- [ ] **Step 1: Build a code graph**

Run the graphify skill on the source: `/graphify mobile/src`. Use the resulting god-nodes / coupling view + `graphify query` to navigate the review (e.g. "what depends on session.ts", "how does the active provider flow").

- [ ] **Step 2: Run the code-review skill**

Invoke the `code-review` skill at high effort over the working tree / the multi-provider surface (`git diff f2a5ffb..HEAD` plus touched legacy files). Collect findings: correctness bugs first, then reuse/simplification/efficiency.

- [ ] **Step 3: Svelte 5 runes review**

Dispatch a focused review (general-purpose agent) over `+layout.svelte`, `+page.svelte`, `tour/[id]/+page.svelte`, `login/+page.svelte`, `SourceMenu.svelte` checking: `$effect` dependency correctness and loops, stale closures, store subscription usage, `$derived` purity, missing cleanup. (The `svelte-skills-kit` plugin failed to install — use the official Svelte 5 runes rules.)

- [ ] **Step 4: Triage + fix**

Fix **real** correctness bugs and cheap, clearly-beneficial cleanups only. Skip speculative/large refactors (lean, not a monster). For each fix, keep `pnpm test && pnpm check` green; add a unit test when the fix is in pure logic.

- [ ] **Step 5: Final verification + commit**

Run: `pnpm test && pnpm check && pnpm build`
Expected: all pass, 0 type errors, build succeeds.

```bash
git add -A
git commit -m "fix(mobile): address code-review findings (correctness + cleanups)"
```

Then build + install on the emulator and smoke-check the core flows (Komoot list/export, Strava activities + routes + export, source menu switch/connect, elevation) — only if behaviour-affecting fixes were made.

---

## Notes

- No version bump / AAB until an explicit "release" (project rule).
- After Task 1, the green bar for `pnpm check` is **0 errors** (not "2 pre-existing").
- Keep it lean: extraction over component-test infra; on-device verification for the native layer; fix real findings, not hypothetical ones.
