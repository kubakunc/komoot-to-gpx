import { describe, it, expect } from 'vitest';
import { EVENTS, decideAnalyticsConsent, track } from '../../src/lib/client/analytics';

describe('EVENTS', () => {
  it('contains the seven spec events', () => {
    expect(Object.values(EVENTS).sort()).toEqual([
      'export_fail',
      'export_success',
      'filter_change',
      'login_fail',
      'login_success',
      'review_prompt_shown',
      'share_intent_received'
    ]);
  });

  it('names are firebase-valid (snake_case, <=40 chars, start with a letter)', () => {
    for (const name of Object.values(EVENTS)) {
      expect(name).toMatch(/^[a-z][a-z0-9_]{0,39}$/);
    }
  });
});

describe('decideAnalyticsConsent', () => {
  it('grants when consent is not required (non-EEA)', () => {
    expect(decideAnalyticsConsent('NOT_REQUIRED')).toBe(true);
  });

  it('grants when consent was obtained', () => {
    expect(decideAnalyticsConsent('OBTAINED')).toBe(true);
  });

  it('denies while consent is required but unresolved', () => {
    expect(decideAnalyticsConsent('REQUIRED')).toBe(false);
  });

  it('denies on unknown status', () => {
    expect(decideAnalyticsConsent('UNKNOWN')).toBe(false);
    expect(decideAnalyticsConsent(undefined)).toBe(false);
  });
});

describe('track', () => {
  it('no-ops without throwing on non-android platforms', async () => {
    await expect(track(EVENTS.EXPORT_SUCCESS, { source: 'list' })).resolves.toBeUndefined();
  });
});
