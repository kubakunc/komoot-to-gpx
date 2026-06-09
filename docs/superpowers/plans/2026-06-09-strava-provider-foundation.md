# Strava Provider — Plan 1: Spike + Provider Abstraction Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify Strava's private web endpoints work under a session cookie (gate), then introduce a tested `Provider` abstraction with Komoot as the first implementation and a multi-provider session store — without changing any existing app behavior.

**Architecture:** All new code is **additive**. We add a `Provider` interface, a `KomootProvider` adapter that wraps the existing `komoot.ts`/`komoot-auth.ts` functions, a provider registry, and a multi-provider session store. The legacy `getSession/setSession/clearSession` functions are kept as thin compatibility wrappers over the Komoot session slot, so every existing page compiles and behaves exactly as before. UI rewiring, the Strava provider, native plugin generalization, and store/legal docs are deliberately deferred to **Plan 2** (authored after Task 0's spike returns real data).

**Tech Stack:** SvelteKit 2 + Svelte 5, TypeScript, Capacitor 6, `@capacitor/preferences`, Vitest (node env). Spec: `docs/superpowers/specs/2026-06-09-strava-provider-design.md`.

**Working directory for all commands:** `mobile/` (the Capacitor app root). All `pnpm` and test commands run from there.

---

### Task 0: Strava web-endpoint spike (GATE — manual, not TDD)

This is an exploratory spike, not a TDD task. Its purpose is to confirm the "twin" approach is viable and to capture real response samples that become test fixtures for Plan 2. **Do not proceed to Plan 2 until this gate passes.** It does not modify app code.

**Files:**
- Create: `mobile/tests/fixtures/strava-training-activities.sample.json` (captured real response, scrubbed of PII)
- Create: `mobile/tests/fixtures/strava-activity-detail.sample.json` (captured real response, scrubbed)
- Create: `docs/superpowers/spikes/2026-06-09-strava-endpoints-findings.md` (the written verdict)

- [ ] **Step 1: Log in to Strava in a desktop browser and capture the session cookie**

In a logged-in `strava.com` browser tab, open DevTools → Application → Cookies. Confirm a `_strava4_session` cookie exists for `.strava.com`. Note its presence (do NOT paste its value anywhere committed).

- [ ] **Step 2: Verify the activity-list endpoint responds to the cookie**

With the same session, in DevTools → Network, load the training log (`strava.com/athlete/training`) and find the XHR that returns the activity rows. Confirm the request URL and that the JSON response lists activities. Candidate: `https://www.strava.com/athlete/training_activities?new_activity_only=false&before=&after=&per_page=20&page=1`.

Record: the exact URL, query params, HTTP status, and the JSON shape (top-level array vs `{models:[...]}`, and per-activity field names for id, name, type/sport, distance, start date, and the encoded map polyline).

Save the (PII-scrubbed: rename to "Sample Ride", round coordinates) response body to `mobile/tests/fixtures/strava-training-activities.sample.json`.

- [ ] **Step 3: Verify the GPX export endpoint responds to the cookie**

In the same browser session, navigate to `https://www.strava.com/activities/<a-real-activity-id>/export_gpx`. Confirm it returns a `.gpx` file (XML starting with `<?xml` / `<gpx`). Record the HTTP status and whether it 302-redirects to a file URL or returns the body directly.

Also test an activity WITHOUT GPS (a manual/indoor entry) and record what `export_gpx` returns (empty body, error page, or non-200).

- [ ] **Step 4: Determine the identity probe**

Find how to read the logged-in athlete's id + display name from the session cookie alone (no OAuth token). Check: does loading `https://www.strava.com/settings/profile` or the dashboard HTML embed the athlete id and name in a predictable place (e.g. a `data-athlete-id` attribute or an inline JSON blob)? Record the exact extraction method.

- [ ] **Step 5: Verify cookie replay from a non-browser HTTP client (the real risk)**

This is the make-or-break check: Cloudflare may reject requests that carry the cookie but lack browser fingerprints. From a terminal, replay the cookie with `curl` (substitute the real cookie value locally; never commit it):

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H 'Cookie: _strava4_session=<VALUE>' \
  -H 'User-Agent: Mozilla/5.0 (Linux; Android 14)' \
  'https://www.strava.com/athlete/training_activities?per_page=5&page=1'
```

Expected for GO: `200`. If you get `403`/`429`/a Cloudflare challenge page, record exactly what came back — this means the Android `CookieManager` + `HttpsURLConnection` path (which sends the cookie but no browser JS) likely needs the WebView's exact User-Agent, or the twin approach is blocked.

- [ ] **Step 6: Write the verdict**

Create `docs/superpowers/spikes/2026-06-09-strava-endpoints-findings.md` documenting, for each of: activity-list endpoint, GPX export endpoint, identity probe, and cookie-replay — the exact URL, status, JSON/field shapes, and a **GO / NO-GO** call. Include the headers required for cookie replay to succeed (especially User-Agent). If NO-GO, state which step failed and stop — the twin approach must be reconsidered (escalate to the human).

- [ ] **Step 7: Commit the spike artifacts**

```bash
git add mobile/tests/fixtures/strava-training-activities.sample.json \
        mobile/tests/fixtures/strava-activity-detail.sample.json \
        docs/superpowers/spikes/2026-06-09-strava-endpoints-findings.md
git commit -m "chore: Strava endpoints spike findings + sample fixtures"
```

**Gate:** Only continue to Task 1 if Step 6's verdict is GO.

---

### Task 1: Provider interface and shared types

Defines the contract every source implements. Pure types plus the `ActivityFilter` union. No runtime logic, so the "test" is that it type-checks and is imported by later tasks.

**Files:**
- Create: `mobile/src/lib/client/provider.ts`

- [ ] **Step 1: Create the provider contract**

Create `mobile/src/lib/client/provider.ts`:

```ts
import type { Coordinate } from './komoot';

export type ProviderId = 'komoot' | 'strava';

/** Persisted, provider-tagged auth state. Replaces the legacy single Session. */
export interface ProviderSession {
  provider: ProviderId;
  userId: string;
  displayName: string; // email (Komoot) or athlete name (Strava)
  token: string;       // long-lived JWT (Komoot) / session marker (Strava)
}

export type ActivityFilter = 'all' | 'recorded' | 'planned';

export interface ActivitySummary {
  id: string;
  name: string;
  sport: string;
  distance: number;
  date: string;
  kind: 'recorded' | 'planned';
  status?: string; // optional visibility/privacy label for the UI badge
}

export interface ActivityPage {
  items: ActivitySummary[];
  page: number;
  totalPages: number;
}

export interface ActivityMeta {
  id: string;
  name: string;
  sport: string;
  date: string;
}

export interface ActivityDetail {
  meta: ActivityMeta;
  preview: Coordinate[];
}

export interface Provider {
  readonly id: ProviderId;
  readonly label: string;
  readonly capabilities: { planned: boolean };
  login(): Promise<ProviderSession>;
  listActivities(
    session: ProviderSession,
    opts: { page: number; filter?: ActivityFilter }
  ): Promise<ActivityPage>;
  getActivity(session: ProviderSession, id: string): Promise<ActivityDetail>;
  getGpx(session: ProviderSession, id: string): Promise<string>;
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `pnpm check`
Expected: no new errors referencing `provider.ts` (pre-existing warnings elsewhere are unchanged).

- [ ] **Step 3: Commit**

```bash
git add mobile/src/lib/client/provider.ts
git commit -m "feat(mobile): add Provider interface and shared activity types"
```

---

### Task 2: Multi-provider session store

Refactor `session.ts` to store one `ProviderSession` per provider, migrate the existing legacy Komoot session on first read, and keep the legacy `getSession/setSession/clearSession/authHeader` API working as thin Komoot-slot wrappers so no existing page changes.

**Files:**
- Modify: `mobile/src/lib/client/session.ts`
- Test: `mobile/tests/unit/session.test.ts`

- [ ] **Step 1: Write the failing test**

Create `mobile/tests/unit/session.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { store } = vi.hoisted(() => ({ store: new Map<string, string>() }));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => { store.set(key, value); },
    remove: async ({ key }: { key: string }) => { store.delete(key); }
  }
}));

import {
  getProviderSession, setProviderSession, clearProviderSession,
  getConnectedProviders, getSession
} from '../../src/lib/client/session';

describe('multi-provider session store', () => {
  beforeEach(() => store.clear());

  it('stores and reads a provider session independently per provider', async () => {
    await setProviderSession({ provider: 'komoot', userId: '1', displayName: 'a@b.c', token: 'K' });
    await setProviderSession({ provider: 'strava', userId: '9', displayName: 'Ada', token: 'S' });

    expect(await getProviderSession('komoot')).toMatchObject({ userId: '1', token: 'K' });
    expect(await getProviderSession('strava')).toMatchObject({ userId: '9', token: 'S' });
    expect((await getConnectedProviders()).sort()).toEqual(['komoot', 'strava']);
  });

  it('clears one provider without touching the other', async () => {
    await setProviderSession({ provider: 'komoot', userId: '1', displayName: 'a@b.c', token: 'K' });
    await setProviderSession({ provider: 'strava', userId: '9', displayName: 'Ada', token: 'S' });
    await clearProviderSession('komoot');
    expect(await getProviderSession('komoot')).toBeNull();
    expect(await getProviderSession('strava')).not.toBeNull();
  });

  it('migrates a legacy Komoot session on first read', async () => {
    store.set('gpx-exporter:session', JSON.stringify({ email: 'old@b.c', userId: '42', token: 'OLD' }));
    const s = await getProviderSession('komoot');
    expect(s).toMatchObject({ provider: 'komoot', userId: '42', displayName: 'old@b.c', token: 'OLD' });
    expect(store.has('gpx-exporter:session')).toBe(false); // legacy key removed
  });

  it('legacy getSession() returns the Komoot session in the old shape', async () => {
    await setProviderSession({ provider: 'komoot', userId: '1', displayName: 'a@b.c', token: 'K' });
    expect(await getSession()).toEqual({ email: 'a@b.c', userId: '1', token: 'K' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- session`
Expected: FAIL — `getProviderSession` (and the other new exports) are not defined.

- [ ] **Step 3: Implement the multi-provider store**

Replace the entire contents of `mobile/src/lib/client/session.ts` with:

```ts
import { Preferences } from '@capacitor/preferences';
import type { ProviderId, ProviderSession } from './provider';

const LEGACY_KEY = 'gpx-exporter:session';
const keyFor = (p: ProviderId) => `gpx-exporter:session:${p}`;
const ALL: ProviderId[] = ['komoot', 'strava'];

/** Legacy shape kept for backward-compatible wrappers. */
export interface Session {
  email: string;
  userId: string;
  token: string;
}

function isValid(s: Partial<ProviderSession> | null): s is ProviderSession {
  return !!s && !!s.provider && !!s.userId && !!s.token;
}

/** One-time migration of the old single-session key into the Komoot slot. */
async function migrateLegacy(): Promise<void> {
  const { value } = await Preferences.get({ key: LEGACY_KEY });
  if (!value) return;
  try {
    const old = JSON.parse(value) as Session;
    if (old.email && old.userId && old.token) {
      const migrated: ProviderSession = {
        provider: 'komoot', userId: old.userId, displayName: old.email, token: old.token
      };
      await Preferences.set({ key: keyFor('komoot'), value: JSON.stringify(migrated) });
    }
  } catch {
    /* corrupted legacy value — drop it */
  }
  await Preferences.remove({ key: LEGACY_KEY });
}

export async function getProviderSession(provider: ProviderId): Promise<ProviderSession | null> {
  if (provider === 'komoot') await migrateLegacy();
  const { value } = await Preferences.get({ key: keyFor(provider) });
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as ProviderSession;
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function setProviderSession(s: ProviderSession): Promise<void> {
  await Preferences.set({ key: keyFor(s.provider), value: JSON.stringify(s) });
}

export async function clearProviderSession(provider: ProviderId): Promise<void> {
  await Preferences.remove({ key: keyFor(provider) });
}

export async function getConnectedProviders(): Promise<ProviderId[]> {
  const out: ProviderId[] = [];
  for (const p of ALL) {
    if (await getProviderSession(p)) out.push(p);
  }
  return out;
}

// ---- Legacy compatibility wrappers (Komoot slot) -------------------------
// Existing pages call these; they keep working unchanged until Plan 2 rewires
// the UI to the provider abstraction.

export async function getSession(): Promise<Session | null> {
  const s = await getProviderSession('komoot');
  return s ? { email: s.displayName, userId: s.userId, token: s.token } : null;
}

export async function setSession(s: Session): Promise<void> {
  await setProviderSession({
    provider: 'komoot', userId: s.userId, displayName: s.email, token: s.token
  });
}

export async function clearSession(): Promise<void> {
  await clearProviderSession('komoot');
}

export function authHeader(s: Session): string {
  return 'Basic ' + btoa(`${s.email}:${s.token}`);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- session`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify the whole suite + type-check still pass**

Run: `pnpm test && pnpm check`
Expected: all existing tests still pass; no new type errors.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/lib/client/session.ts mobile/tests/unit/session.test.ts
git commit -m "feat(mobile): multi-provider session store with legacy migration"
```

---

### Task 3: KomootProvider adapter

Wrap the existing Komoot functions behind the `Provider` interface. No Komoot logic changes — this is a pure adapter, mapping `TourSummary` → `ActivitySummary` and exposing `getActivity`/`getGpx`.

**Files:**
- Create: `mobile/src/lib/client/providers/komoot.ts`
- Test: `mobile/tests/unit/provider-komoot.test.ts`

- [ ] **Step 1: Write the failing test**

Create `mobile/tests/unit/provider-komoot.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { listTours, getTour, getCoordinates, nativeLogin, toGpx } = vi.hoisted(() => ({
  listTours: vi.fn(), getTour: vi.fn(), getCoordinates: vi.fn(),
  nativeLogin: vi.fn(), toGpx: vi.fn()
}));

vi.mock('../../src/lib/client/komoot', () => ({
  listTours, getTour, getCoordinates,
  downsample: <T>(a: T[]) => a
}));
vi.mock('../../src/lib/client/komoot-auth', () => ({ nativeLogin }));
vi.mock('../../src/lib/client/gpx', () => ({ toGpx }));

import { komootProvider } from '../../src/lib/client/providers/komoot';
import type { ProviderSession } from '../../src/lib/client/provider';

const session: ProviderSession = { provider: 'komoot', userId: '42', displayName: 'a@b.c', token: 'T' };

describe('komootProvider', () => {
  beforeEach(() => { listTours.mockReset(); getTour.mockReset(); getCoordinates.mockReset(); nativeLogin.mockReset(); toGpx.mockReset(); });

  it('declares planned capability and a label', () => {
    expect(komootProvider.id).toBe('komoot');
    expect(komootProvider.capabilities.planned).toBe(true);
    expect(komootProvider.label).toBe('Komoot');
  });

  it('login() maps native result to a ProviderSession', async () => {
    nativeLogin.mockResolvedValueOnce({ userId: '42', token: 'T', email: 'a@b.c' });
    const s = await komootProvider.login();
    expect(s).toEqual({ provider: 'komoot', userId: '42', displayName: 'a@b.c', token: 'T' });
  });

  it('listActivities() maps tours to activity summaries with kind', async () => {
    listTours.mockResolvedValueOnce({
      tours: [
        { id: '1', name: 'Ride', sport: 'racebike', distance: 1000, date: 'd', status: 'private', type: 'tour_recorded' },
        { id: '2', name: 'Plan', sport: 'hike', distance: 2000, date: 'e', status: 'public', type: 'tour_planned' }
      ],
      page: 0, totalPages: 3
    });
    const out = await komootProvider.listActivities(session, { page: 0, filter: 'all' });
    expect(listTours).toHaveBeenCalledWith(
      { email: 'a@b.c', token: 'T' }, { userId: '42', page: 0, filter: 'all' }
    );
    expect(out.totalPages).toBe(3);
    expect(out.items[0]).toMatchObject({ id: '1', kind: 'recorded', status: 'private' });
    expect(out.items[1]).toMatchObject({ id: '2', kind: 'planned', status: 'public' });
  });

  it('getActivity() returns meta + downsampled preview', async () => {
    getTour.mockResolvedValueOnce({ id: '1', name: 'Ride', sport: 'racebike', date: '2026-01-01T00:00:00Z' });
    getCoordinates.mockResolvedValueOnce([{ lat: 1, lng: 2 }]);
    const d = await komootProvider.getActivity(session, '1');
    expect(d.meta).toMatchObject({ id: '1', name: 'Ride' });
    expect(d.preview).toEqual([{ lat: 1, lng: 2 }]);
  });

  it('getGpx() builds GPX from coordinates', async () => {
    getTour.mockResolvedValueOnce({ id: '1', name: 'Ride', sport: 'racebike', date: '2026-01-01T00:00:00Z' });
    getCoordinates.mockResolvedValueOnce([{ lat: 1, lng: 2 }]);
    toGpx.mockReturnValueOnce('<gpx/>');
    const xml = await komootProvider.getGpx(session, '1');
    expect(toGpx).toHaveBeenCalledWith(
      { name: 'Ride', sport: 'racebike', startTimeIso: '2026-01-01T00:00:00Z' },
      [{ lat: 1, lng: 2 }]
    );
    expect(xml).toBe('<gpx/>');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- provider-komoot`
Expected: FAIL — `providers/komoot` module not found.

- [ ] **Step 3: Implement the adapter**

Create `mobile/src/lib/client/providers/komoot.ts`:

```ts
import type {
  Provider, ProviderSession, ActivityPage, ActivityDetail, ActivityFilter, ActivitySummary
} from '../provider';
import { listTours, getTour, getCoordinates, downsample, type TourSummary } from '../komoot';
import { nativeLogin } from '../komoot-auth';
import { toGpx } from '../gpx';

const PREVIEW_POINTS = 160;

function toSummary(t: TourSummary): ActivitySummary {
  return {
    id: t.id,
    name: t.name,
    sport: t.sport,
    distance: t.distance,
    date: t.date,
    kind: t.type === 'tour_planned' ? 'planned' : 'recorded',
    status: t.status
  };
}

export const komootProvider: Provider = {
  id: 'komoot',
  label: 'Komoot',
  capabilities: { planned: true },

  async login(): Promise<ProviderSession> {
    const { userId, token, email } = await nativeLogin();
    return { provider: 'komoot', userId, displayName: email, token };
  },

  async listActivities(session, opts): Promise<ActivityPage> {
    const filter: ActivityFilter = opts.filter ?? 'all';
    const data = await listTours(
      { email: session.displayName, token: session.token },
      { userId: session.userId, page: opts.page, filter }
    );
    return { items: data.tours.map(toSummary), page: data.page, totalPages: data.totalPages };
  },

  async getActivity(session, id): Promise<ActivityDetail> {
    const auth = { email: session.displayName, token: session.token };
    const meta = await getTour(auth, id);
    const coords = await getCoordinates(auth, id, meta.date);
    return {
      meta: { id: meta.id, name: meta.name, sport: meta.sport, date: meta.date },
      preview: downsample(coords, PREVIEW_POINTS)
    };
  },

  async getGpx(session, id): Promise<string> {
    const auth = { email: session.displayName, token: session.token };
    const meta = await getTour(auth, id);
    const coords = await getCoordinates(auth, id, meta.date);
    return toGpx({ name: meta.name, sport: meta.sport, startTimeIso: meta.date }, coords);
  }
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- provider-komoot`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add mobile/src/lib/client/providers/komoot.ts mobile/tests/unit/provider-komoot.test.ts
git commit -m "feat(mobile): KomootProvider adapter over existing Komoot client"
```

---

### Task 4: Provider registry

A small lookup so consumers fetch a provider by id and enumerate available providers. In Plan 1 only Komoot is registered; Plan 2 adds Strava with a one-line change.

**Files:**
- Create: `mobile/src/lib/client/providers/registry.ts`
- Test: `mobile/tests/unit/provider-registry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `mobile/tests/unit/provider-registry.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

// Komoot adapter pulls in native modules; stub them so the registry imports cleanly.
vi.mock('../../src/lib/client/komoot', () => ({
  listTours: vi.fn(), getTour: vi.fn(), getCoordinates: vi.fn(), downsample: <T>(a: T[]) => a
}));
vi.mock('../../src/lib/client/komoot-auth', () => ({ nativeLogin: vi.fn() }));
vi.mock('../../src/lib/client/gpx', () => ({ toGpx: vi.fn() }));

import { getProvider, availableProviders } from '../../src/lib/client/providers/registry';

describe('provider registry', () => {
  it('returns the Komoot provider by id', () => {
    expect(getProvider('komoot').id).toBe('komoot');
  });

  it('lists available providers (Komoot in Plan 1)', () => {
    expect(availableProviders().map((p) => p.id)).toContain('komoot');
  });

  it('throws on an unknown provider id', () => {
    // @ts-expect-error intentional bad id
    expect(() => getProvider('garmin')).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- provider-registry`
Expected: FAIL — `providers/registry` module not found.

- [ ] **Step 3: Implement the registry**

Create `mobile/src/lib/client/providers/registry.ts`:

```ts
import type { Provider, ProviderId } from '../provider';
import { komootProvider } from './komoot';

// Plan 2 adds: import { stravaProvider } from './strava';
const REGISTRY: Record<ProviderId, Provider> = {
  komoot: komootProvider,
  // strava: stravaProvider,  // ← Plan 2
} as Record<ProviderId, Provider>;

export function getProvider(id: ProviderId): Provider {
  const p = REGISTRY[id];
  if (!p) throw new Error(`Unknown provider: ${id}`);
  return p;
}

export function availableProviders(): Provider[] {
  return Object.values(REGISTRY).filter(Boolean);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- provider-registry`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify the full suite + type-check**

Run: `pnpm test && pnpm check`
Expected: all tests pass; no new type errors. The app build is unchanged (no page imports the new modules yet).

- [ ] **Step 6: Commit**

```bash
git add mobile/src/lib/client/providers/registry.ts mobile/tests/unit/provider-registry.test.ts
git commit -m "feat(mobile): provider registry (Komoot registered)"
```

---

## Plan 1 done — what ships

A tested `Provider` abstraction, a `KomootProvider` adapter, a provider registry, and a multi-provider session store with legacy migration. **The app behaves exactly as before** — existing pages still use the legacy session wrappers; nothing is wired to the new abstraction yet. No version bump, no AAB (per project rule: release only on explicit instruction). No `mobile/` user-facing behavior changed, so no CHANGELOG entry is required for Plan 1 (the abstraction is internal); the CHANGELOG entry lands in Plan 2 when Strava becomes user-visible.

## Plan 2 (authored AFTER Task 0's spike returns GO + fixtures)

Written with the real Strava endpoint shapes the spike captured. Task outline (full code deferred until spike data exists, to avoid guessing wire formats):

1. **Polyline decoder** (`src/lib/client/polyline.ts`) — decode Google encoded polyline → `Coordinate[]`; TDD with table tests.
2. **Strava response mappers** (`src/lib/client/providers/strava-map.ts`) — map the captured `training_activities` JSON → `ActivitySummary[]`; TDD against `strava-training-activities.sample.json`.
3. **StravaProvider** (`src/lib/client/providers/strava.ts`) — `login`/`listActivities`/`getActivity` (polyline preview)/`getGpx` (binary `export_gpx` passthrough); register in `registry.ts`; TDD with mocked native bridge.
4. **Native: generalize `KomootApiPlugin` → `WebSessionApiPlugin`** — Bearer mode (Komoot) + cookie-replay mode (Strava, reading `CookieManager`) + binary `download` for `export_gpx`. Keep Komoot behavior 1:1.
5. **Native: generalize `KomootAuthPlugin`/`LoginActivity`** — provider-parameterized login URL, cookie domain, and identity probe; add Strava config; persist the Strava cookie natively.
6. **UI rewire** — route layout/list/detail through `getProvider(...)` + multi-provider session; two sign-in buttons; segmented source switcher; `capabilities.planned` filter gating; "Powered by Strava" badge.
7. **Analytics `provider` dimension** on every event.
8. **Store/legal** — privacy policy (`§3/§4/§6`), per-locale listing description + disclaimer, Data Safety doc (no new data types); CHANGELOG entry "Added Strava…".
9. **Deferred (follow-up, NOT in Plan 2):** Strava share-intent.
