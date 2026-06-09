import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGet, mockPost } = vi.hoisted(() => ({ mockGet: vi.fn(), mockPost: vi.fn() }));
vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({ get: mockGet, post: mockPost }) }));

import {
  listActivities, listRoutes, getGpx, getRouteGpx, getStreamCoordinates, getActivityName, StravaError
} from '../../src/lib/client/strava';

beforeEach(() => { mockGet.mockReset(); mockPost.mockReset(); });

describe('strava.listActivities', () => {
  it('requests page+1 and parses the models', async () => {
    mockGet.mockResolvedValueOnce({ status: 200, body: JSON.stringify({ models: [{ id: 9, name: 'R', sport_type: 'Ride' }] }) });
    const out = await listActivities(0, 'activities');
    expect(mockGet).toHaveBeenCalledWith({ path: '/athlete/training_activities?per_page=20&page=1' });
    expect(out.items[0].id).toBe('activity-9');
  });
  it('maps 401 to a StravaError(401)', async () => {
    mockGet.mockResolvedValueOnce({ status: 401, body: '' });
    await expect(listActivities(0, 'activities')).rejects.toMatchObject({ name: 'StravaError', status: 401 });
  });
});

describe('strava.listRoutes', () => {
  it('POSTs the my-routes endpoint and parses nodes', async () => {
    mockPost.mockResolvedValueOnce({ status: 200, body: JSON.stringify({ me: { searchRoutes: { nodes: [{ id: '7', title: 'T', length: 100, routeType: 'Ride' }], pageInfo: { hasNextPage: false } } } }) });
    const out = await listRoutes(0);
    expect(mockPost.mock.calls[0][0].path).toBe('/api/next/data/routes/my-routes');
    expect(out.items[0].id).toBe('route-7');
  });
  it('does NOT treat 403 as auth failure (no 401)', async () => {
    mockPost.mockResolvedValueOnce({ status: 403, body: '' });
    await expect(listRoutes(0)).rejects.toMatchObject({ name: 'StravaError', status: 403 });
  });
  it('maps a real 401 to 401', async () => {
    mockPost.mockResolvedValueOnce({ status: 401, body: '' });
    await expect(listRoutes(0)).rejects.toMatchObject({ status: 401 });
  });
});

describe('strava GPX export', () => {
  it('passes a GPX body through', async () => {
    mockGet.mockResolvedValueOnce({ status: 200, body: '<?xml?><gpx/>' });
    expect(await getGpx('5')).toContain('<gpx');
  });
  it('rejects a non-GPX body as no-track (422)', async () => {
    mockGet.mockResolvedValueOnce({ status: 200, body: 'Not found' });
    await expect(getGpx('5')).rejects.toMatchObject({ status: 422 });
  });
  it('route export hits the routes path', async () => {
    mockGet.mockResolvedValueOnce({ status: 200, body: '<gpx/>' });
    await getRouteGpx('7');
    expect(mockGet).toHaveBeenCalledWith({ path: '/routes/7/export_gpx' });
  });
});

describe('strava streams + name', () => {
  it('returns [] when streams are unavailable', async () => {
    mockGet.mockResolvedValueOnce({ status: 404, body: '' });
    expect(await getStreamCoordinates('5')).toEqual([]);
  });
  it('extracts the activity name from <title>, stripping the suffix', async () => {
    mockGet.mockResolvedValueOnce({ status: 200, body: '<html><head><title>Evening Ride | Strava</title></head></html>' });
    expect(await getActivityName('5')).toBe('Evening Ride');
  });
});

void StravaError;
