import { describe, it, expect } from 'vitest';
import { stravaId, parseStravaId } from '../../src/lib/client/strava-id';

describe('strava-id', () => {
  it('builds prefixed ids', () => {
    expect(stravaId('activity', '123')).toBe('activity-123');
    expect(stravaId('route', '9')).toBe('route-9');
  });
  it('parses prefixed ids', () => {
    expect(parseStravaId('activity-123')).toEqual({ type: 'activity', rawId: '123' });
    expect(parseStravaId('route-9')).toEqual({ type: 'route', rawId: '9' });
  });
  it('defaults bare ids to activity (back-compat)', () => {
    expect(parseStravaId('555')).toEqual({ type: 'activity', rawId: '555' });
  });
});
