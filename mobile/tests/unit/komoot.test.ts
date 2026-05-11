import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  listTours,
  getTour,
  getCoordinates,
  KomootError
} from '../../src/lib/client/komoot';

vi.mock('@capacitor/core', () => ({
  CapacitorHttp: { request: vi.fn() }
}));

import { CapacitorHttp } from '@capacitor/core';

const fixture = (name: string) =>
  readFileSync(resolve(__dirname, '../fixtures', name), 'utf8');

describe('komoot.listTours', () => {
  beforeEach(() => vi.mocked(CapacitorHttp.request).mockReset());

  it('GETs /v007/users/{id}/tours/ with Basic auth and maps response', async () => {
    const body = JSON.parse(fixture('tours-page.json'));
    vi.mocked(CapacitorHttp.request).mockResolvedValueOnce({
      status: 200,
      data: body,
      headers: {},
      url: ''
    });

    const page = await listTours(
      { email: 'a@b.c', token: 'TOKEN' },
      { userId: '12345', page: 0 }
    );

    const call = vi.mocked(CapacitorHttp.request).mock.calls[0][0];
    expect(call.url).toBe(
      'https://api.komoot.de/v007/users/12345/tours/?type=tour_recorded%2Ctour_planned&page=0&limit=24'
    );
    expect(call.headers!.Authorization).toBe('Basic ' + btoa('a@b.c:TOKEN'));
    expect(page.totalPages).toBe(1);
    expect(page.tours[0].name).toBe('Wieczorny ride');
    expect(page.tours[0].sport).toBe('racebike');
  });
});

describe('komoot.getTour', () => {
  beforeEach(() => vi.mocked(CapacitorHttp.request).mockReset());

  it('GETs /v007/tours/{id} and returns mapped metadata', async () => {
    const body = JSON.parse(fixture('tour.json'));
    vi.mocked(CapacitorHttp.request).mockResolvedValueOnce({
      status: 200,
      data: body,
      headers: {},
      url: ''
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
  beforeEach(() => vi.mocked(CapacitorHttp.request).mockReset());

  it('GETs /coordinates and converts ms-offset t to ISO using start time', async () => {
    const body = JSON.parse(fixture('coordinates.json'));
    vi.mocked(CapacitorHttp.request).mockResolvedValueOnce({
      status: 200,
      data: body,
      headers: {},
      url: ''
    });

    const coords = await getCoordinates(
      { email: 'a@b.c', token: 'T' },
      '111',
      '2026-04-30T17:30:00Z'
    );

    expect(coords).toHaveLength(2);
    expect(coords[0]).toEqual({
      lat: 52.52,
      lng: 13.405,
      alt: 34.0,
      t: '2026-04-30T17:30:00.000Z'
    });
    expect(coords[1]).toEqual({
      lat: 52.521,
      lng: 13.406,
      alt: 35.5,
      t: '2026-04-30T17:30:30.000Z'
    });
  });
});

void KomootError;
