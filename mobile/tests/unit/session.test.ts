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
  getConnectedProviders
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
    // Migration runs once per process; earlier tests already triggered it on the
    // shared module instance, so import a fresh one for this case.
    vi.resetModules();
    const { getProviderSession: freshGet } = await import('../../src/lib/client/session');
    const s = await freshGet('komoot');
    expect(s).toMatchObject({ provider: 'komoot', userId: '42', displayName: 'old@b.c', token: 'OLD' });
    expect(store.has('gpx-exporter:session')).toBe(false); // legacy key removed
  });
});
