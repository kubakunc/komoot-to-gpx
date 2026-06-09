# Source Nav + Per-Provider Filters + Strava Routes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a header source menu (switch/connect/sign-out), generalize filters to be provider-declared, fix Strava elevation, and add Strava planned Routes.

**Architecture:** Generalize `Provider.capabilities` to a declared filter set; a new `SourceMenu.svelte` in the layout drives switching and connecting via a reactive `activeProvider` store; Strava gains a `routes` filter (separate endpoint + `route-`/`activity-` id namespace) gated on a mini-spike; the streams call also pulls altitude.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, TypeScript, Capacitor 6, Vitest (node env). Spec: `docs/superpowers/specs/2026-06-09-source-nav-and-strava-routes-design.md`.

**Working directory for all commands:** `mobile/`.

---

### Task 1: Generalize filters to a provider-declared set

Replace `capabilities: { planned: boolean }` with `capabilities: { filters: ProviderFilter[] }` and make `ActivityFilter` a plain string. Update both providers and their tests.

**Files:**
- Modify: `mobile/src/lib/client/provider.ts`
- Modify: `mobile/src/lib/client/providers/komoot.ts`
- Modify: `mobile/src/lib/client/providers/strava.ts`
- Modify: `mobile/tests/unit/provider-komoot.test.ts`, `mobile/tests/unit/provider-registry.test.ts`

- [ ] **Step 1: Update the Provider contract**

In `mobile/src/lib/client/provider.ts`, replace `export type ActivityFilter = 'all' | 'recorded' | 'planned';` with:

```ts
export type ActivityFilter = string;

export interface ProviderFilter {
  id: string;
  label: string;
}
```

And in the `Provider` interface replace `readonly capabilities: { planned: boolean };` with:

```ts
  readonly capabilities: { filters: ProviderFilter[] };
```

- [ ] **Step 2: Update KomootProvider**

In `mobile/src/lib/client/providers/komoot.ts`, replace `capabilities: { planned: true },` with:

```ts
  capabilities: {
    filters: [
      { id: 'all', label: 'All' },
      { id: 'recorded', label: 'Completed' },
      { id: 'planned', label: 'Planned' }
    ]
  },
```

The `listActivities` body already passes `filter` through to `listTours`; leave it. (`listTours` accepts `'all'|'recorded'|'planned'`; the chip ids match.)

- [ ] **Step 3: Update StravaProvider capabilities + filter routing**

In `mobile/src/lib/client/providers/strava.ts`, replace `capabilities: { planned: false },` with:

```ts
  capabilities: {
    filters: [
      { id: 'activities', label: 'Activities' },
      { id: 'routes', label: 'Routes' }
    ]
  },
```

Leave `listActivities` calling `listActivities(opts.page, opts.filter ?? 'activities')` — wire the routes branch in Task 6. For now change the default in the call to `'activities'`:

```ts
  async listActivities(_session, opts): Promise<ActivityPage> {
    return listActivities(opts.page, opts.filter ?? 'activities');
  },
```

- [ ] **Step 4: Update the tests**

In `mobile/tests/unit/provider-komoot.test.ts`, replace the capability assertion:

```ts
  it('declares its filters and a label', () => {
    expect(komootProvider.id).toBe('komoot');
    expect(komootProvider.capabilities.filters.map((f) => f.id)).toEqual(['all', 'recorded', 'planned']);
    expect(komootProvider.label).toBe('Komoot');
  });
```

In `mobile/tests/unit/provider-registry.test.ts`, replace the `Strava has no planned capability` test with:

```ts
  it('Strava exposes activities + routes filters', () => {
    expect(getProvider('strava').capabilities.filters.map((f) => f.id)).toEqual(['activities', 'routes']);
  });
```

- [ ] **Step 5: Run tests + check**

Run: `pnpm test && pnpm check`
Expected: all tests pass; the only `pnpm check` errors are the 2 pre-existing ones (`analytics.ts` ConsentType, `MiniMap.svelte` tap).

- [ ] **Step 6: Commit**

```bash
git add mobile/src/lib/client/provider.ts mobile/src/lib/client/providers/komoot.ts \
        mobile/src/lib/client/providers/strava.ts mobile/tests/unit/provider-komoot.test.ts \
        mobile/tests/unit/provider-registry.test.ts
git commit -m "refactor(mobile): provider-declared filter sets (capabilities.filters)"
```

---

### Task 2: Reactive active-provider store

Add a Svelte store so the source menu (layout) and the list (page) stay in sync when the active source changes, while keeping the plain getters for non-reactive callers (detail page).

**Files:**
- Modify: `mobile/src/lib/client/active-provider.ts`
- Test: `mobile/tests/unit/active-provider.test.ts`

- [ ] **Step 1: Write the failing test**

Create `mobile/tests/unit/active-provider.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

const { store } = vi.hoisted(() => ({ store: new Map<string, string>() }));
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k)
});

import { getActiveProvider, setActiveProvider, activeProvider } from '../../src/lib/client/active-provider';

describe('active-provider', () => {
  beforeEach(() => store.clear());

  it('defaults to komoot and round-trips through the store + sessionStorage', () => {
    expect(getActiveProvider()).toBe('komoot');
    setActiveProvider('strava');
    expect(getActiveProvider()).toBe('strava');
    expect(get(activeProvider)).toBe('strava');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- active-provider`
Expected: FAIL — `activeProvider` is not exported.

- [ ] **Step 3: Implement the store**

Replace `mobile/src/lib/client/active-provider.ts` with:

```ts
import { writable } from 'svelte/store';
import type { ProviderId } from './provider';

const KEY = 'gpx-exporter:active-provider';

function read(): ProviderId {
  if (typeof sessionStorage === 'undefined') return 'komoot';
  const v = sessionStorage.getItem(KEY);
  return v === 'strava' || v === 'komoot' ? v : 'komoot';
}

/** Reactive active source; components subscribe to react to switches. */
export const activeProvider = writable<ProviderId>(read());

/** Non-reactive read for one-shot callers (e.g. the detail page on mount). */
export function getActiveProvider(): ProviderId {
  return read();
}

export function setActiveProvider(id: ProviderId): void {
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    /* sessionStorage unavailable — fall back to the default on next read */
  }
  activeProvider.set(id);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm test -- active-provider`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/lib/client/active-provider.ts mobile/tests/unit/active-provider.test.ts
git commit -m "feat(mobile): reactive activeProvider store"
```

---

### Task 3: SourceMenu component + header wiring

Add the header dropdown that switches sources, connects the second provider, and signs out. Remove the external "Komoot" header link.

**Files:**
- Create: `mobile/src/lib/client/SourceMenu.svelte`
- Modify: `mobile/src/routes/+layout.svelte`

- [ ] **Step 1: Create SourceMenu.svelte**

Create `mobile/src/lib/client/SourceMenu.svelte`:

```svelte
<script lang="ts">
  import { getConnectedProviders, getProviderSession, setProviderSession, clearProviderSession } from '$lib/client/session';
  import { setActiveProvider, activeProvider } from '$lib/client/active-provider';
  import { getProvider, availableProviders } from '$lib/client/providers/registry';
  import type { ProviderId } from '$lib/client/provider';
  import { track, EVENTS } from '$lib/client/analytics';

  let { onSignedOut }: { onSignedOut: () => void } = $props();

  let open = $state(false);
  let connected = $state<ProviderId[]>([]);
  let labels = $state<Record<string, string>>({});
  let busy = $state<ProviderId | null>(null);

  async function refresh() {
    connected = await getConnectedProviders();
    const next: Record<string, string> = {};
    for (const p of connected) {
      const s = await getProviderSession(p);
      next[p] = s?.displayName ?? getProvider(p).label;
    }
    labels = next;
  }

  $effect(() => { void refresh(); });

  function toggle() { open = !open; }

  function switchTo(id: ProviderId) {
    open = false;
    if (id === $activeProvider) return;
    setActiveProvider(id);
  }

  async function connect(id: ProviderId) {
    busy = id;
    try {
      const session = await getProvider(id).login();
      await setProviderSession(session);
      setActiveProvider(id);
      void track(EVENTS.LOGIN_SUCCESS, { provider: id });
      await refresh();
      open = false;
    } catch (e) {
      const err = e as Error;
      if (err?.name !== 'AuthCancelledError') {
        void track(EVENTS.LOGIN_FAIL, { provider: id, reason: 'error' });
      }
    } finally {
      busy = null;
    }
  }

  async function signOut() {
    open = false;
    for (const p of await getConnectedProviders()) await clearProviderSession(p);
    onSignedOut();
  }
</script>

<div class="menu">
  <button class="trigger" onclick={toggle} aria-haspopup="menu" aria-expanded={open}>
    {getProvider($activeProvider).label}
    <span class="caret" aria-hidden="true">▾</span>
  </button>

  {#if open}
    <button class="scrim" aria-label="Close menu" onclick={() => (open = false)}></button>
    <div class="dropdown" role="menu">
      {#each availableProviders() as p (p.id)}
        {#if connected.includes(p.id)}
          <button class="row" role="menuitem" onclick={() => switchTo(p.id)}>
            <span class="dot" class:active={p.id === $activeProvider}></span>
            {p.label}{#if labels[p.id] && labels[p.id] !== p.label}<span class="who"> · {labels[p.id]}</span>{/if}
          </button>
        {:else}
          <button class="row" role="menuitem" disabled={busy !== null} onclick={() => connect(p.id)}>
            <span class="dot"></span>
            {busy === p.id ? `Connecting ${p.label}…` : `Connect ${p.label}`}
          </button>
        {/if}
      {/each}
      <div class="sep"></div>
      <button class="row signout" role="menuitem" onclick={signOut}>Sign out</button>
    </div>
  {/if}
</div>

<style>
  .menu { position: relative; }
  .trigger {
    display: inline-flex; align-items: center; gap: 0.3rem;
    font-size: 0.85rem; font-weight: 600; color: var(--color-fg);
    background: var(--color-bg); border: 1px solid var(--color-border);
    border-radius: var(--radius-full); padding: 0.35rem 0.8rem; cursor: pointer;
  }
  .trigger:hover { border-color: var(--color-fg); }
  .caret { font-size: 0.7rem; color: var(--color-fg-muted); }
  .scrim { position: fixed; inset: 0; z-index: 20; background: transparent; border: 0; }
  .dropdown {
    position: absolute; right: 0; top: calc(100% + 0.4rem); z-index: 21;
    min-width: 220px; background: var(--color-surface);
    border: 1px solid var(--color-border); border-radius: var(--radius);
    box-shadow: var(--shadow-md); padding: 0.35rem; display: flex; flex-direction: column;
  }
  .row {
    display: flex; align-items: center; gap: 0.55rem;
    width: 100%; text-align: left; background: transparent; border: 0;
    padding: 0.6rem 0.7rem; font-size: 0.88rem; color: var(--color-fg);
    border-radius: var(--radius-sm); cursor: pointer;
  }
  .row:hover { background: var(--color-bg-soft); }
  .row:disabled { opacity: 0.6; cursor: progress; }
  .who { color: var(--color-fg-muted); font-weight: 400; }
  .dot { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid var(--color-border-strong); flex-shrink: 0; }
  .dot.active { background: var(--color-fg); border-color: var(--color-fg); }
  .sep { height: 1px; background: var(--color-border); margin: 0.35rem 0.2rem; }
  .signout { color: var(--color-fg-muted); }
</style>
```

- [ ] **Step 2: Wire it into the layout header**

In `mobile/src/routes/+layout.svelte`, replace the `<nav class="nav">…</nav>` block (the Komoot external link + user label + logout button) with the SourceMenu, shown only when a provider is connected. First add the import near the other imports:

```ts
  import SourceMenu from '$lib/client/SourceMenu.svelte';
```

Then replace the nav markup:

```svelte
    <nav class="nav">
      {#if userLabel}
        <SourceMenu onSignedOut={() => { userLabel = null; goto('/login', { replaceState: true }); }} />
      {/if}
    </nav>
```

Remove the now-unused `signOut` function in the layout `<script>` (the menu owns sign-out) and the `.nav-link`, `.user`, `.logout` style rules. Keep `refreshUserLabel`, the share-hash handling, and the boot routing.

- [ ] **Step 3: Verify check + build**

Run: `pnpm check && pnpm build`
Expected: only the 2 pre-existing `check` errors; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/lib/client/SourceMenu.svelte mobile/src/routes/+layout.svelte
git commit -m "feat(mobile): header source menu — switch sources, connect second provider"
```

---

### Task 4: List page — dynamic filter chips + react to source switch; remove inline switcher

Render the filter chips from `provider.capabilities.filters`, default to the first, reload when the active source changes (driven by the store), and drop the old inline segmented switcher and `capabilities.planned` references.

**Files:**
- Modify: `mobile/src/routes/+page.svelte`

- [ ] **Step 1: Update the script**

In `mobile/src/routes/+page.svelte`, change the active-provider import to also pull the store:

```ts
  import { getActiveProvider, setActiveProvider, activeProvider } from '$lib/client/active-provider';
```

Change `let filter = $state<ActivityFilter>('all');` to:

```ts
  let filter = $state<string>('all');
```

Replace `switchTo`, `setSource`, and the `onMount` source-reconciliation with a store-driven reload. Replace the `switchTo` and `setSource` functions with:

```ts
  function applyActiveProvider(id: ProviderId) {
    activeProviderId = id;
    filter = getProvider(id).capabilities.filters[0]?.id ?? 'all';
    resetList();
    void loadPage(0);
  }
```

Rename the existing `let activeProvider = $state<ProviderId>('komoot');` to `let activeProviderId = $state<ProviderId>('komoot');` (avoid colliding with the imported store) and update every reference in the file (`provider` derived, `loadPage`, `loadShape`, `download`, `onAuthFail`, `activityUrl`, analytics calls, the `{#if activeProviderId === 'strava'}` and `{#if activeProviderId === 'komoot'}` template guards).

Update `onAuthFail` to use the helper:

```ts
  async function onAuthFail() {
    await clearProviderSession(activeProviderId);
    connected = await getConnectedProviders();
    if (connected.length === 0) { await goto('/login', { replaceState: true }); return; }
    setActiveProvider(connected[0]);
  }
```

Replace `setFilter` to keep using the string id (no type change needed beyond `string`).

- [ ] **Step 2: React to the store + initial load**

Replace the `onMount(() => { … })` block with a store-driven effect plus one-time setup:

```ts
  onMount(() => {
    void showBanner();
    return () => { void hideBanner(); };
  });

  $effect(() => {
    const id = $activeProvider;
    void (async () => {
      connected = await getConnectedProviders();
      let active = id;
      if (connected.length > 0 && !connected.includes(active)) {
        active = connected[0];
        setActiveProvider(active); // re-enters this effect with the corrected id
        return;
      }
      if (active === activeProviderId && tours.length > 0) return; // already showing it
      applyActiveProvider(active);
      showShareReminder = active === 'komoot' && shouldShowShareReminder();
    })();
  });
```

- [ ] **Step 3: Replace the source switcher + filter markup**

Remove the entire `{#if connected.length > 1} <div class="sources">…</div> {/if}` block (the inline switcher — the header menu replaces it).

Replace the `{#if provider.capabilities.planned} … fixed chips … {/if}` filter block with chips rendered from the provider's filter set:

```svelte
{#if provider.capabilities.filters.length > 1}
  <div class="filters" role="tablist" aria-label="Filter">
    {#each provider.capabilities.filters as f (f.id)}
      <button class="chip" role="tab" aria-selected={filter === f.id} class:active={filter === f.id}
        onclick={() => setFilter(f.id)}>{f.label}</button>
    {/each}
  </div>
{/if}
```

Update the `{#if activeProvider === 'strava'}` / `{#if activeProvider === 'komoot'}` guards to `activeProviderId`. Remove the `.sources`/`.source` style rules (no longer used).

- [ ] **Step 4: Verify check, build, tests**

Run: `pnpm test && pnpm check && pnpm build`
Expected: tests pass; only the 2 pre-existing `check` errors; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/routes/+page.svelte
git commit -m "feat(mobile): dynamic per-provider filter chips; react to source switch"
```

---

### Task 5: Elevation gain for Strava (altitude stream)

Pull the altitude stream alongside latlng and merge into coordinates so the detail screen shows real elevation gain.

**Files:**
- Modify: `mobile/src/lib/client/providers/strava-map.ts`
- Modify: `mobile/src/lib/client/strava.ts`
- Test: `mobile/tests/unit/strava-map.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `mobile/tests/unit/strava-map.test.ts`:

```ts
import { streamsToCoordinates } from '../../src/lib/client/providers/strava-map';

describe('strava-map.streamsToCoordinates', () => {
  it('zips latlng with altitude', () => {
    const body = JSON.stringify({ latlng: [[1, 2], [3, 4]], altitude: [100, 110] });
    expect(streamsToCoordinates(body)).toEqual([
      { lat: 1, lng: 2, alt: 100 },
      { lat: 3, lng: 4, alt: 110 }
    ]);
  });

  it('omits alt when altitude stream is absent', () => {
    const body = JSON.stringify({ latlng: [[1, 2]] });
    expect(streamsToCoordinates(body)).toEqual([{ lat: 1, lng: 2 }]);
  });

  it('returns empty on malformed json', () => {
    expect(streamsToCoordinates('nope')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- strava-map`
Expected: FAIL — `streamsToCoordinates` not exported.

- [ ] **Step 3: Implement the merged mapper**

In `mobile/src/lib/client/providers/strava-map.ts`, replace `latlngToCoordinates` with `streamsToCoordinates`:

```ts
/** Parse the streams `{ latlng: [[lat,lng],...], altitude?: [m,...] }` response. */
export function streamsToCoordinates(body: string): Coordinate[] {
  try {
    const d = JSON.parse(body);
    const ll: unknown = d?.latlng;
    if (!Array.isArray(ll)) return [];
    const alt: unknown = d?.altitude;
    const altArr = Array.isArray(alt) ? alt : null;
    return ll
      .filter((p): p is [number, number] => Array.isArray(p) && p.length >= 2)
      .map((p, i) => {
        const c: Coordinate = { lat: Number(p[0]), lng: Number(p[1]) };
        if (altArr && altArr[i] != null) c.alt = Number(altArr[i]);
        return c;
      });
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Request the altitude stream**

In `mobile/src/lib/client/strava.ts`, update the import and `getStreamCoordinates`:

```ts
import { parseActivityList, streamsToCoordinates } from './providers/strava-map';
```

```ts
export async function getStreamCoordinates(id: string): Promise<Coordinate[]> {
  const { status, body } = await get(
    `/activities/${encodeURIComponent(id)}/streams?stream_types%5B%5D=latlng&stream_types%5B%5D=altitude`,
    'getStreams'
  );
  if (status < 200 || status >= 300) return [];
  return streamsToCoordinates(body);
}
```

- [ ] **Step 5: Update the old latlng test name**

In `mobile/tests/unit/strava-map.test.ts`, the previous `latlngToCoordinates` describe block now refers to a removed export — rename its calls to `streamsToCoordinates` (same behaviour for latlng-only input) or delete that block since the new describe covers it. Ensure no reference to `latlngToCoordinates` remains.

- [ ] **Step 6: Run tests + check**

Run: `pnpm test && pnpm check`
Expected: tests pass; only the 2 pre-existing `check` errors.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/lib/client/providers/strava-map.ts mobile/src/lib/client/strava.ts mobile/tests/unit/strava-map.test.ts
git commit -m "fix(mobile): Strava elevation — pull altitude stream into coordinates"
```

---

### Task 6: Strava Routes — mini-spike (GATE, manual, not TDD)

Verify the routes endpoints on a live Strava account and capture fixtures. **Do not start Task 7 until this returns GO.** No app code changes.

**Files:**
- Create: `mobile/tests/fixtures/strava-routes.sample.json`
- Create: `docs/superpowers/spikes/2026-06-09-strava-routes-findings.md`

- [ ] **Step 1: Capture the routes list**

With a logged-in Strava session cookie (same method as the first spike — cookie in a local file, never committed), fetch the candidate routes endpoint as an XHR:

```bash
curl -s -H "Cookie: _strava4_session=<VALUE>" \
  -H "X-Requested-With: XMLHttpRequest" -H "Accept: application/json" \
  -A "Mozilla/5.0 (Linux; Android 14)" \
  "https://www.strava.com/athletes/<ATHLETE_ID>/routes?page=1" | head -c 1200
```

Record: exact URL + params, HTTP status, JSON shape (array vs `{...}`), and per-row field names for id, name, distance, elevation gain, created date, and the preview source (a `map.summary_polyline` encoded string, or a latlng array). Save a PII-scrubbed sample to `mobile/tests/fixtures/strava-routes.sample.json`.

- [ ] **Step 2: Verify route GPX export**

```bash
curl -s -o /tmp/route.gpx -w "%{http_code} %{content_type}\n" \
  -H "Cookie: _strava4_session=<VALUE>" -A "Mozilla/5.0 (Linux; Android 14)" \
  "https://www.strava.com/routes/<ROUTE_ID>/export_gpx"
head -c 120 /tmp/route.gpx
```

Record status, content type, and that the body is GPX (`<?xml`/`<gpx`).

- [ ] **Step 3: Determine the preview source + write the verdict**

Note whether the route preview comes from an encoded polyline (→ Task 7 adds a polyline decoder) or a latlng array (→ reuse `streamsToCoordinates`). Write `docs/superpowers/spikes/2026-06-09-strava-routes-findings.md` with each endpoint's URL/status/shape and a **GO / NO-GO**. Confirm the `altitude` stream key name used in Task 5 while you have the session.

- [ ] **Step 4: Commit the spike artifacts**

```bash
git add mobile/tests/fixtures/strava-routes.sample.json docs/superpowers/spikes/2026-06-09-strava-routes-findings.md
git commit -m "chore: Strava routes mini-spike findings + fixture"
```

**Gate:** continue to Task 7 only on GO.

---

### Task 7: Strava Routes — id namespace, mapper, provider routing

Add the `routes` data path: a typed id namespace (`activity-`/`route-`), a routes mapper, and `getActivity`/`getGpx` routing to the right endpoint. Field names and the preview source come from Task 6's findings/fixture; the structure below is fixed.

**Files:**
- Create: `mobile/src/lib/client/strava-id.ts`
- Modify: `mobile/src/lib/client/providers/strava-map.ts` (routes mapper)
- Modify: `mobile/src/lib/client/strava.ts` (routes list + route GPX + route preview)
- Modify: `mobile/src/lib/client/providers/strava.ts` (filter routing + id-aware getActivity/getGpx)
- Test: `mobile/tests/unit/strava-id.test.ts`, `mobile/tests/unit/strava-map.test.ts`

- [ ] **Step 1: Write the id-namespace test**

Create `mobile/tests/unit/strava-id.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { stravaId, parseStravaId } from '../../src/lib/client/strava-id';

describe('strava-id', () => {
  it('builds prefixed ids', () => {
    expect(stravaId('activity', '123')).toBe('activity-123');
    expect(stravaId('route', '9')).toBe('route-9');
  });
  it('parses prefixed ids', () => {
    expect(parseStravaId('activity-123')).toEqual({ type: 'activity', rawId: '123' });
    expect(parseStravaId('route-9')).toEqual({ type: 'route', rawId: '9' });
  });
  it('defaults bare ids to activity (back-compat)', () => {
    expect(parseStravaId('555')).toEqual({ type: 'activity', rawId: '555' });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- strava-id`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the id namespace**

Create `mobile/src/lib/client/strava-id.ts`:

```ts
export type StravaItemType = 'activity' | 'route';

export function stravaId(type: StravaItemType, rawId: string): string {
  return `${type}-${rawId}`;
}

export function parseStravaId(id: string): { type: StravaItemType; rawId: string } {
  if (id.startsWith('route-')) return { type: 'route', rawId: id.slice('route-'.length) };
  if (id.startsWith('activity-')) return { type: 'activity', rawId: id.slice('activity-'.length) };
  return { type: 'activity', rawId: id }; // bare id ⇒ activity
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm test -- strava-id`
Expected: PASS.

- [ ] **Step 5: Routes mapper (fields from Task 6 fixture)**

In `mobile/src/lib/client/providers/strava-map.ts`, add a routes mapper. Use the field names confirmed in Task 6 (the example below uses `id`, `name`, `distance`, `elevation_gain`, `created_at`; adjust to the fixture). Activities already prefix via Task 7 Step 6; routes prefix with `route-`:

```ts
import { stravaId } from '../strava-id';

export interface StravaRouteModel {
  id: number | string;
  name?: string;
  distance?: number;        // meters
  elevation_gain?: number;
  created_at?: string;
  sub_type?: number | string;
}

export function routeToSummary(r: StravaRouteModel): ActivitySummary {
  return {
    id: stravaId('route', String(r.id)),
    name: r.name ?? 'Untitled route',
    sport: 'Route',
    distance: Number(r.distance ?? 0),
    date: r.created_at ?? '',
    kind: 'planned',
    status: undefined
  };
}

export function parseRouteList(body: string, page: number, perPage: number): ActivityPage {
  let rows: StravaRouteModel[] = [];
  try {
    const d = JSON.parse(body);
    rows = Array.isArray(d) ? d : (d.routes ?? d.models ?? []);
  } catch {
    rows = [];
  }
  const items = rows.map(routeToSummary);
  const totalPages = items.length >= perPage ? page + 2 : page + 1;
  return { items, page, totalPages };
}
```

Also prefix activity ids in `toActivitySummary`: change `id: String(m.id),` to `id: stravaId('activity', String(m.id)),`. Update the existing `parseActivityList` test expectations from `'1000000000001'` to `'activity-1000000000001'`.

- [ ] **Step 6: Routes list + route GPX + route preview in strava.ts**

In `mobile/src/lib/client/strava.ts`, add routes support. Use the routes list URL and preview source confirmed in Task 6 (example assumes `/athletes` is not needed because the session is implicit; adjust path to the fixture's endpoint). Add:

```ts
import { parseActivityList, parseRouteList, streamsToCoordinates } from './providers/strava-map';
```

```ts
export async function listRoutes(page: number): Promise<ActivityPage> {
  const { status, body } = await get(
    `/athlete/routes?per_page=${PER_PAGE}&page=${page + 1}`,
    'listRoutes'
  );
  if (status < 200 || status >= 300) {
    throw new StravaError(`listRoutes failed (${status})`, status >= 500 ? 502 : status);
  }
  return parseRouteList(body, page, PER_PAGE);
}

export async function getRouteGpx(rawId: string): Promise<string> {
  const { status, body } = await get(`/routes/${encodeURIComponent(rawId)}/export_gpx`, 'route_export_gpx');
  if (status < 200 || status >= 300) {
    throw new StravaError(`route export_gpx failed (${status})`, status >= 500 ? 502 : status);
  }
  if (!body.trimStart().startsWith('<')) throw new StravaError('No GPS track for this route', 422);
  return body;
}
```

If Task 6 found routes expose only an encoded `summary_polyline` (no latlng/streams), create `mobile/src/lib/client/polyline.ts` with a Google-polyline decoder and use it for the route preview; otherwise reuse the streams approach. Add a route preview fetch (`getRoutePreview(rawId)`) matching the confirmed source.

- [ ] **Step 7: Provider routing by filter + id**

In `mobile/src/lib/client/providers/strava.ts`, route the list by filter and route `getActivity`/`getGpx` by id type:

```ts
import { listActivities, listRoutes, getStreamCoordinates, getRoutePreview, getActivityName, getGpx, getRouteGpx } from '../strava';
import { parseStravaId } from '../strava-id';
```

```ts
  async listActivities(_session, opts): Promise<ActivityPage> {
    return (opts.filter ?? 'activities') === 'routes' ? listRoutes(opts.page) : listActivities(opts.page, 'activities');
  },

  async getActivity(_session, id): Promise<ActivityDetail> {
    const { type, rawId } = parseStravaId(id);
    if (type === 'route') {
      const preview = await getRoutePreview(rawId);
      return { meta: { id, name: `Route ${rawId}`, sport: 'Route', date: '' }, preview };
    }
    const [coords, name] = await Promise.all([getStreamCoordinates(rawId), getActivityName(rawId)]);
    return { meta: { id, name: name || `Strava activity ${rawId}`, sport: '', date: '' }, preview: coords };
  },

  async getGpx(_session, id): Promise<string> {
    const { type, rawId } = parseStravaId(id);
    return type === 'route' ? getRouteGpx(rawId) : getGpx(rawId);
  }
```

(`getActivityName`/`getGpx`/`getStreamCoordinates` already take the raw id; the calls now pass `rawId`.)

- [ ] **Step 8: Run tests + check + build + Kotlin**

Run: `pnpm test && pnpm check && pnpm build`
Then: `cd android && ./gradlew assembleDebug` (no Kotlin changed, but confirms packaging).
Expected: tests pass; only the 2 pre-existing `check` errors; build + APK succeed.

- [ ] **Step 9: Commit**

```bash
git add mobile/src/lib/client/strava-id.ts mobile/src/lib/client/providers/strava-map.ts \
        mobile/src/lib/client/strava.ts mobile/src/lib/client/providers/strava.ts \
        mobile/tests/unit/strava-id.test.ts mobile/tests/unit/strava-map.test.ts
git commit -m "feat(mobile): Strava planned Routes (activities/routes filter, typed ids)"
```

---

### Task 8: CHANGELOG + on-device verification

**Files:**
- Modify: `mobile/CHANGELOG.md`

- [ ] **Step 1: Add the CHANGELOG entry**

Under `## [Unreleased]` → `### Added` in `mobile/CHANGELOG.md`, append:

```markdown
- **Switch and connect sources from the header menu.** Tap the source name
  (top-right) to switch between Komoot and Strava, connect the other account
  without signing out, or sign out.
- **Strava planned Routes.** Switch between **Activities** and **Routes** when
  Strava is the active source, and export either as GPX.
- Strava activities now show **elevation gain**.
```

- [ ] **Step 2: Commit**

```bash
git add mobile/CHANGELOG.md
git commit -m "docs(mobile): changelog for source menu + Strava Routes + elevation"
```

- [ ] **Step 3: On-device verification (manual)**

Build + install (`pnpm android:build`, `adb install -r`), then verify on the emulator:
- Header shows the active source; the menu switches sources and "Connect {other}" runs the login flow and adds it without dropping the first.
- Komoot tours + Completed/Planned filter visible when Komoot is active.
- Strava shows the Activities/Routes toggle; Routes list loads; exporting a route saves a GPX.
- Strava activity detail shows a real elevation gain.

Do not bump the version or build an AAB until an explicit "release".

---

## Notes

- No version bump / AAB until "release" (project rule).
- The 2 pre-existing `pnpm check` errors (`analytics.ts:55` ConsentType, `MiniMap.svelte:29` tap) are unrelated; "only those 2" is the green bar.
- Tasks 1–5 need no spike and can ship first; Tasks 6–7 are gated on the routes mini-spike.
