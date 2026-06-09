import { describe, it, expect, beforeEach, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); }
});

const sessionStore = new Map<string, string>();
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => sessionStore.get(k) ?? null,
  setItem: (k: string, v: string) => { sessionStore.set(k, v); },
  removeItem: (k: string) => { sessionStore.delete(k); },
  clear: () => { sessionStore.clear(); }
});

import {
  extractTourId,
  readShareHash,
  setPendingShare,
  consumePendingShare,
  markViaShare,
  wasViaShare
} from '../../src/lib/client/share-intent';

describe('extractTourId', () => {
  it('parses www.komoot.com/tour/N', () => {
    expect(extractTourId('https://www.komoot.com/tour/12345')).toBe('12345');
  });

  it('parses komoot.de/tour/N', () => {
    expect(extractTourId('https://komoot.de/tour/9876')).toBe('9876');
  });

  it('parses www.komoot.de/tour/N', () => {
    expect(extractTourId('https://www.komoot.de/tour/42')).toBe('42');
  });

  it('parses url surrounded by noise', () => {
    expect(extractTourId('Hey check https://komoot.com/tour/42 :)')).toBe('42');
  });

  it('parses URL with locale prefix (Komoot share format)', () => {
    expect(extractTourId('https://www.komoot.com/pl-pl/tour/2789486857?ref=aso&share_token=abc')).toBe('2789486857');
  });

  it('parses URL with en-us locale', () => {
    expect(extractTourId('https://www.komoot.com/en-us/tour/12345')).toBe('12345');
  });

  it('parses URL with de-de locale on .de host', () => {
    expect(extractTourId('https://www.komoot.de/de-de/tour/99')).toBe('99');
  });

  it('parses URL with unknown future locale segment', () => {
    expect(extractTourId('https://www.komoot.com/en-int/tour/100')).toBe('100');
    expect(extractTourId('https://www.komoot.com/zh-cn/tour/200')).toBe('200');
  });

  it('case-insensitive on host', () => {
    expect(extractTourId('https://www.KOMOOT.com/tour/77')).toBe('77');
  });

  it('returns null for non-komoot host', () => {
    expect(extractTourId('https://example.com/tour/12345')).toBeNull();
  });

  it('returns null for komoot non-tour url', () => {
    expect(extractTourId('https://www.komoot.com/collection/123')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractTourId('')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(extractTourId(null)).toBeNull();
    expect(extractTourId(undefined)).toBeNull();
  });
});

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
    expect(readShareHash('')).toBeNull();
    expect(readShareHash('#about')).toBeNull();
    expect(readShareHash('#share=garmin:1')).toBeNull();
    expect(readShareHash('#share-tour=')).toBeNull();
  });
});

describe('pending share (provider-aware)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips a target and clears on consume', () => {
    setPendingShare({ provider: 'strava', id: 'route-123' });
    expect(consumePendingShare()).toEqual({ provider: 'strava', id: 'route-123' });
    expect(consumePendingShare()).toBeNull();
  });

  it('returns null on missing or corrupt', () => {
    expect(consumePendingShare()).toBeNull();
    localStorage.setItem('gpx-exporter:pending-share-tour', 'not json');
    expect(consumePendingShare()).toBeNull();
  });
});

describe('via-share source marker', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('reports true for the marked tour id', () => {
    markViaShare('123');
    expect(wasViaShare('123')).toBe(true);
  });

  it('reports false for a different tour id', () => {
    markViaShare('123');
    expect(wasViaShare('456')).toBe(false);
  });

  it('reports false when nothing was marked', () => {
    expect(wasViaShare('123')).toBe(false);
  });
});
