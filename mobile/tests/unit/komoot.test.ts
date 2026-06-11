import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('@capacitor/core', () => ({
  registerPlugin: () => ({ get: mockGet })
}));

import {
  listTours,
  getTour,
  getCoordinates,
  KomootError,
  onTokenRefreshed
} from '../../src/lib/client/komoot';

const fixture = (name: string) =>
  readFileSync(resolve(__dirname, '../fixtures', name), 'utf8');

describe('komoot.listTours', () => {
  beforeEach(() => mockGet.mockReset());

  it('hits /v007/users/{id}/tours/ with Bearer token and maps response', async () => {
    mockGet.mockResolvedValueOnce({
      status: 200,
      body: fixture('tours-page.json')
    });

    const page = await listTours(
      { email: 'a@b.c', token: 'TOKEN' },
      { userId: '12345', page: 0 }
    );

    expect(mockGet).toHaveBeenCalledWith({
      path: '/v007/users/12345/tours/?type=tour_recorded%2Ctour_planned&page=0&limit=24',
      token: 'TOKEN'
    });
    expect(page.totalPages).toBe(1);
    expect(page.tours[0].name).toBe('Wieczorny ride');
    expect(page.tours[0].sport).toBe('racebike');
  });

  it('throws KomootError(401) on unauthorized', async () => {
    mockGet.mockResolvedValueOnce({ status: 401, body: '' });
    await expect(
      listTours({ email: 'a@b.c', token: 'X' }, { userId: '1', page: 0 })
    ).rejects.toMatchObject({ name: 'KomootError', status: 401 });
  });
});

describe('komoot.getTour', () => {
  beforeEach(() => mockGet.mockReset());

  it('hits /v007/tours/{id} and returns metadata', async () => {
    mockGet.mockResolvedValueOnce({
      status: 200,
      body: fixture('tour.json')
    });

    const meta = await getTour({ email: 'a@b.c', token: 'T' }, '111');
    expect(meta).toEqual({
      id: '111',
      name: 'Wieczorny ride',
      sport: 'racebike',
      date: '2026-04-30T17:30:00Z'
    });
  });
});

describe('komoot.getCoordinates', () => {
  beforeEach(() => mockGet.mockReset());

  it('hits /coordinates and converts ms-offset t to ISO using start time', async () => {
    mockGet.mockResolvedValueOnce({
      status: 200,
      body: fixture('coordinates.json')
    });

    const coords = await getCoordinates(
      { email: 'a@b.c', token: 'T' },
      '111',
      '2026-04-30T17:30:00Z'
    );

    expect(coords).toHaveLength(2);
    expect(coords[0]).toEqual({
      lat: 52.52, lng: 13.405, alt: 34.0, t: '2026-04-30T17:30:00.000Z'
    });
  });

  it('returns empty when items missing', async () => {
    mockGet.mockResolvedValueOnce({ status: 200, body: '{}' });
    const coords = await getCoordinates(
      { email: 'a@b.c', token: 'T' },
      '111',
      '2026-01-01T00:00:00Z'
    );
    expect(coords).toEqual([]);
  });
});

void KomootError;

describe('komoot token refresh propagation', () => {
  beforeEach(() => mockGet.mockReset());

  it('mutates the auth object and fires the hook when newToken is returned', async () => {
    const refreshed: string[] = [];
    onTokenRefreshed((t) => refreshed.push(t));
    mockGet.mockResolvedValueOnce({ status: 200, body: fixture('tours-page.json'), newToken: 'FRESH' });

    const auth = { email: 'a@b.c', token: 'STALE' };
    await listTours(auth, { userId: '1', page: 0 });

    expect(auth.token).toBe('FRESH');
    expect(refreshed).toEqual(['FRESH']);
    onTokenRefreshed(null);
  });

  it('does not fire the hook when no newToken is returned', async () => {
    const refreshed: string[] = [];
    onTokenRefreshed((t) => refreshed.push(t));
    mockGet.mockResolvedValueOnce({ status: 200, body: fixture('tours-page.json') });

    const auth = { email: 'a@b.c', token: 'STALE' };
    await listTours(auth, { userId: '1', page: 0 });

    expect(auth.token).toBe('STALE');
    expect(refreshed).toEqual([]);
    onTokenRefreshed(null);
  });
});
