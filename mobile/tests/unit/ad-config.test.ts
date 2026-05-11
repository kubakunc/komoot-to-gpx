import { describe, it, expect, vi } from 'vitest';

describe('ad-config', () => {
  it('returns Google test IDs in dev mode', async () => {
    vi.stubGlobal('__DEV__', true);
    vi.resetModules();
    const { AD_UNITS } = await import('../../src/lib/client/ad-config');
    expect(AD_UNITS.banner).toBe('ca-app-pub-3940256099942544/6300978111');
    expect(AD_UNITS.rect).toBe('ca-app-pub-3940256099942544/6300978111');
    expect(AD_UNITS.interstitial).toBe('ca-app-pub-3940256099942544/1033173712');
  });

  it('returns production IDs when not in dev', async () => {
    vi.stubGlobal('__DEV__', false);
    vi.resetModules();
    const { AD_UNITS } = await import('../../src/lib/client/ad-config');
    // Until production IDs are configured (Task 7), prod resolves to test IDs
    // as a deliberate safety net. The Task 7 swap will update this assertion.
    expect(AD_UNITS.banner).toBe('ca-app-pub-3940256099942544/6300978111');
    expect(typeof AD_UNITS.interstitial).toBe('string');
  });
});
