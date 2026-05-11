import { describe, it, expect, beforeEach, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); }
});

import {
  extractTourId,
  readShareHash,
  setPendingShare,
  consumePendingShare
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
  it('reads #share-tour=N', () => {
    expect(readShareHash('#share-tour=12345')).toBe('12345');
  });

  it('returns null for empty hash', () => {
    expect(readShareHash('')).toBeNull();
  });

  it('returns null for unrelated hash', () => {
    expect(readShareHash('#about')).toBeNull();
  });

  it('returns null for malformed hash', () => {
    expect(readShareHash('#share-tour=')).toBeNull();
    expect(readShareHash('#share-tour=abc')).toBeNull();
  });
});

describe('pending share storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sets and consumes', () => {
    setPendingShare('555');
    expect(consumePendingShare()).toBe('555');
  });

  it('consume clears the entry', () => {
    setPendingShare('555');
    consumePendingShare();
    expect(consumePendingShare()).toBeNull();
  });

  it('consume returns null when nothing pending', () => {
    expect(consumePendingShare()).toBeNull();
  });
});
