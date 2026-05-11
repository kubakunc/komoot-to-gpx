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
    expect(AD_UNITS.banner).toMatch(/^ca-app-pub-\d+\/\d+$/);
    expect(AD_UNITS.banner).not.toBe('ca-app-pub-3940256099942544/6300978111');
    expect(AD_UNITS.rect).toMatch(/^ca-app-pub-\d+\/\d+$/);
    expect(AD_UNITS.interstitial).toMatch(/^ca-app-pub-\d+\/\d+$/);
    expect(AD_UNITS.interstitial).not.toBe('ca-app-pub-3940256099942544/1033173712');
  });
});
