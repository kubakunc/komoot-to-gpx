import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  listActivities: vi.fn(), listRoutes: vi.fn(),
  getStreamCoordinates: vi.fn(), getActivityName: vi.fn(),
  getGpx: vi.fn(), getRouteDetail: vi.fn(), getRouteGpx: vi.fn()
}));
vi.mock('../../src/lib/client/strava', () => m);
vi.mock('../../src/lib/client/strava-auth', () => ({ nativeStravaLogin: vi.fn() }));

import { stravaProvider } from '../../src/lib/client/providers/strava';
import type { ProviderSession } from '../../src/lib/client/provider';

const s: ProviderSession = { provider: 'strava', userId: '1', displayName: 'A', token: 'web-session' };

beforeEach(() => Object.values(m).forEach((f) => f.mockReset()));

describe('stravaProvider list routing', () => {
  it('routes the "routes" filter to listRoutes', async () => {
    m.listRoutes.mockResolvedValueOnce({ items: [], page: 0, totalPages: 1 });
    await stravaProvider.listActivities(s, { page: 2, filter: 'routes' });
    expect(m.listRoutes).toHaveBeenCalledWith(2);
    expect(m.listActivities).not.toHaveBeenCalled();
  });
  it('routes anything else to listActivities', async () => {
    m.listActivities.mockResolvedValueOnce({ items: [], page: 0, totalPages: 1 });
    await stravaProvider.listActivities(s, { page: 0, filter: 'activities' });
    expect(m.listActivities).toHaveBeenCalledWith(0, 'activities');
  });
});

describe('stravaProvider id dispatch', () => {
  it('getGpx routes a route id to getRouteGpx with the raw id', async () => {
    m.getRouteGpx.mockResolvedValueOnce('<gpx/>');
    await stravaProvider.getGpx(s, 'route-77');
    expect(m.getRouteGpx).toHaveBeenCalledWith('77');
    expect(m.getGpx).not.toHaveBeenCalled();
  });
  it('getGpx routes an activity id to getGpx with the raw id', async () => {
    m.getGpx.mockResolvedValueOnce('<gpx/>');
    await stravaProvider.getGpx(s, 'activity-9');
    expect(m.getGpx).toHaveBeenCalledWith('9');
  });
  it('getActivity for a route parses GPX detail', async () => {
    m.getRouteDetail.mockResolvedValueOnce({ name: 'Loop', coords: [{ lat: 1, lng: 2 }] });
    const d = await stravaProvider.getActivity(s, 'route-77');
    expect(m.getRouteDetail).toHaveBeenCalledWith('77');
    expect(d.meta.name).toBe('Loop');
    expect(d.preview).toEqual([{ lat: 1, lng: 2 }]);
  });
  it('getActivity for an activity uses streams + name', async () => {
    m.getStreamCoordinates.mockResolvedValueOnce([{ lat: 3, lng: 4 }]);
    m.getActivityName.mockResolvedValueOnce('Ride');
    const d = await stravaProvider.getActivity(s, 'activity-9');
    expect(m.getStreamCoordinates).toHaveBeenCalledWith('9');
    expect(d.meta.name).toBe('Ride');
  });
});
