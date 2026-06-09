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
