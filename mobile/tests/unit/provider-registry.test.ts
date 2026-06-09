import { describe, it, expect, vi } from 'vitest';

// Provider adapters pull in native modules; stub them so the registry imports cleanly.
vi.mock('@capacitor/core', () => ({
  registerPlugin: () => ({}),
  Capacitor: { getPlatform: () => 'web' }
}));
vi.mock('../../src/lib/client/komoot', () => ({
  listTours: vi.fn(), getTour: vi.fn(), getCoordinates: vi.fn(), downsample: <T>(a: T[]) => a
}));
vi.mock('../../src/lib/client/komoot-auth', () => ({ nativeLogin: vi.fn() }));
vi.mock('../../src/lib/client/gpx', () => ({ toGpx: vi.fn() }));

import { getProvider, availableProviders } from '../../src/lib/client/providers/registry';

describe('provider registry', () => {
  it('returns the Komoot and Strava providers by id', () => {
    expect(getProvider('komoot').id).toBe('komoot');
    expect(getProvider('strava').id).toBe('strava');
  });

  it('lists both available providers', () => {
    const ids = availableProviders().map((p) => p.id).sort();
    expect(ids).toEqual(['komoot', 'strava']);
  });

  it('Strava exposes activities + routes filters', () => {
    expect(getProvider('strava').capabilities.filters.map((f) => f.id)).toEqual(['activities', 'routes']);
  });

  it('throws on an unknown provider id', () => {
    // @ts-expect-error intentional bad id
    expect(() => getProvider('garmin')).toThrow();
  });
});
