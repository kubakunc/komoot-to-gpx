import { describe, it, expect, vi, beforeEach } from 'vitest';

const { listTours, getTour, getCoordinates, nativeLogin, toGpx } = vi.hoisted(() => ({
  listTours: vi.fn(), getTour: vi.fn(), getCoordinates: vi.fn(),
  nativeLogin: vi.fn(), toGpx: vi.fn()
}));

vi.mock('../../src/lib/client/komoot', () => ({
  listTours, getTour, getCoordinates,
  downsample: <T>(a: T[]) => a
}));
vi.mock('../../src/lib/client/komoot-auth', () => ({ nativeLogin }));
vi.mock('../../src/lib/client/gpx', () => ({ toGpx }));

import { komootProvider } from '../../src/lib/client/providers/komoot';
import type { ProviderSession } from '../../src/lib/client/provider';

const session: ProviderSession = { provider: 'komoot', userId: '42', displayName: 'a@b.c', token: 'T' };

describe('komootProvider', () => {
  beforeEach(() => { listTours.mockReset(); getTour.mockReset(); getCoordinates.mockReset(); nativeLogin.mockReset(); toGpx.mockReset(); });

  it('declares its filters and a label', () => {
    expect(komootProvider.id).toBe('komoot');
    expect(komootProvider.capabilities.filters.map((f) => f.id)).toEqual(['all', 'recorded', 'planned']);
    expect(komootProvider.label).toBe('Komoot');
  });

  it('login() maps native result to a ProviderSession', async () => {
    nativeLogin.mockResolvedValueOnce({ userId: '42', token: 'T', email: 'a@b.c' });
    const s = await komootProvider.login();
    expect(s).toEqual({ provider: 'komoot', userId: '42', displayName: 'a@b.c', token: 'T' });
  });

  it('listActivities() maps tours to activity summaries with kind', async () => {
    listTours.mockResolvedValueOnce({
      tours: [
        { id: '1', name: 'Ride', sport: 'racebike', distance: 1000, date: 'd', status: 'private', type: 'tour_recorded' },
        { id: '2', name: 'Plan', sport: 'hike', distance: 2000, date: 'e', status: 'public', type: 'tour_planned' }
      ],
      page: 0, totalPages: 3
    });
    const out = await komootProvider.listActivities(session, { page: 0, filter: 'all' });
    expect(listTours).toHaveBeenCalledWith(
      { email: 'a@b.c', token: 'T' }, { userId: '42', page: 0, filter: 'all' }
    );
    expect(out.totalPages).toBe(3);
    expect(out.items[0]).toMatchObject({ id: '1', kind: 'recorded', status: 'private' });
    expect(out.items[1]).toMatchObject({ id: '2', kind: 'planned', status: 'public' });
  });

  it('getActivity() returns meta + downsampled preview', async () => {
    getTour.mockResolvedValueOnce({ id: '1', name: 'Ride', sport: 'racebike', date: '2026-01-01T00:00:00Z' });
    getCoordinates.mockResolvedValueOnce([{ lat: 1, lng: 2 }]);
    const d = await komootProvider.getActivity(session, '1');
    expect(d.meta).toMatchObject({ id: '1', name: 'Ride' });
    expect(d.preview).toEqual([{ lat: 1, lng: 2 }]);
  });

  it('getGpx() builds GPX from coordinates', async () => {
    getTour.mockResolvedValueOnce({ id: '1', name: 'Ride', sport: 'racebike', date: '2026-01-01T00:00:00Z' });
    getCoordinates.mockResolvedValueOnce([{ lat: 1, lng: 2 }]);
    toGpx.mockReturnValueOnce('<gpx/>');
    const xml = await komootProvider.getGpx(session, '1');
    expect(toGpx).toHaveBeenCalledWith(
      { name: 'Ride', sport: 'racebike', startTimeIso: '2026-01-01T00:00:00Z' },
      [{ lat: 1, lng: 2 }]
    );
    expect(xml).toBe('<gpx/>');
  });
});
