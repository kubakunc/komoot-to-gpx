import { describe, it, expect, beforeEach, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); }
});

import { shouldShowShareReminder } from '../../src/lib/client/share-hint';

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_750_000_000_000;

describe('shouldShowShareReminder', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not pop up on first launch (sets baseline only)', () => {
    expect(shouldShowShareReminder(T0)).toBe(false);
  });

  it('does not pop up within 14 days of the baseline', () => {
    shouldShowShareReminder(T0);
    expect(shouldShowShareReminder(T0 + DAY)).toBe(false);
    expect(shouldShowShareReminder(T0 + 13 * DAY)).toBe(false);
  });

  it('pops up once 14+ days have passed', () => {
    shouldShowShareReminder(T0);
    expect(shouldShowShareReminder(T0 + 14 * DAY)).toBe(true);
  });

  it('after popping up, waits another 14 days', () => {
    shouldShowShareReminder(T0);
    expect(shouldShowShareReminder(T0 + 15 * DAY)).toBe(true);
    expect(shouldShowShareReminder(T0 + 16 * DAY)).toBe(false);
    expect(shouldShowShareReminder(T0 + 29 * DAY)).toBe(true);
  });

  it('frequent launches keep resetting nothing — interval is since last popup', () => {
    shouldShowShareReminder(T0);
    for (let d = 1; d <= 13; d++) {
      expect(shouldShowShareReminder(T0 + d * DAY)).toBe(false);
    }
    expect(shouldShowShareReminder(T0 + 14 * DAY)).toBe(true);
  });
});
