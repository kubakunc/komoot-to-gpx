import { describe, it, expect, vi } from 'vitest';
vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({}) }));

import { KomootError } from '../../src/lib/client/komoot';
import { StravaError } from '../../src/lib/client/strava';
import { isProviderAuthError } from '../../src/lib/client/auth-errors';

describe('isProviderAuthError', () => {
  it('is true only for a 401 from either provider', () => {
    expect(isProviderAuthError(new KomootError('x', 401))).toBe(true);
    expect(isProviderAuthError(new StravaError('x', 401))).toBe(true);
  });
  it('is false for 403, 5xx and other statuses (must not sign out)', () => {
    expect(isProviderAuthError(new StravaError('x', 403))).toBe(false);
    expect(isProviderAuthError(new KomootError('x', 502))).toBe(false);
  });
  it('is false for non-provider errors', () => {
    expect(isProviderAuthError(new Error('nope'))).toBe(false);
    expect(isProviderAuthError(null)).toBe(false);
  });
});
