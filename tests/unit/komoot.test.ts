import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  login,
  listTours,
  getTour,
  getCoordinates,
  KomootError
} from '../../src/lib/server/komoot';

const ORIGINAL_FETCH = globalThis.fetch;

const fixture = (name: string) =>
  readFileSync(resolve(__dirname, '../fixtures', name), 'utf8');

describe('komoot.login', () => {
  beforeEach(() => {
    vi.stubEnv('KOMOOT_BASE_URL', 'https://api.komoot.de');
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    vi.unstubAllEnvs();
  });

  it('sends GET to /v006/account/email/{email}/ with Basic auth and returns userId+token', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://api.komoot.de/v006/account/email/jakub%40example.com/');
      expect(init?.method).toBe('GET');
      const auth = (init?.headers as Record<string, string>).Authorization;
      expect(auth).toBe('Basic ' + Buffer.from('jakub@example.com:secret').toString('base64'));
      return new Response(
        JSON.stringify({ username: '12345', password: 'TOKEN_XYZ', email: 'jakub@example.com' }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await login('jakub@example.com', 'secret');

    expect(result).toEqual({
      userId: '12345',
      token: 'TOKEN_XYZ',
      email: 'jakub@example.com'
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('throws KomootError with status 401 on invalid credentials', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('Unauthorized', { status: 401 })
    ) as unknown as typeof fetch;

    await expect(login('a@b.c', 'wrong')).rejects.toMatchObject({
      name: 'KomootError',
      status: 401
    });
  });

  it('throws KomootError with status 502 when komoot returns 5xx', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('Bad Gateway', { status: 502 })
    ) as unknown as typeof fetch;
    await expect(login('a@b.c', 'x')).rejects.toMatchObject({
      name: 'KomootError',
      status: 502
    });
  });

  it('does not include password in error message', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('Unauthorized', { status: 401 })
    ) as unknown as typeof fetch;

    try {
      await login('a@b.c', 'super-secret-password');
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as Error).message).not.toContain('super-secret-password');
    }
  });
});

describe('komoot.listTours', () => {
  beforeEach(() => vi.stubEnv('KOMOOT_BASE_URL', 'https://api.komoot.de'));
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    vi.unstubAllEnvs();
  });

  it('GETs /v007/users/{id}/tours/ with Basic auth, page param and maps response', async () => {
    const body = fixture('tours-page.json');

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(
        'https://api.komoot.de/v007/users/12345/tours/?type=tour_recorded%2Ctour_planned&page=0&limit=24'
      );
      expect((init?.headers as Record<string, string>).Authorization).toBe(
        'Basic ' + Buffer.from('a@b.c:TOKEN').toString('base64')
      );
      return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const page = await listTours(
      { email: 'a@b.c', token: 'TOKEN' },
      { userId: '12345', page: 0 }
    );

    expect(page.totalPages).toBe(1);
    expect(page.tours).toHaveLength(2);
    expect(page.tours[0]).toEqual({
      id: '111',
      name: 'Wieczorny ride',
      sport: 'racebike',
      distance: 42500,
      date: '2026-04-30T17:30:00Z',
      status: 'private',
      type: 'tour_recorded'
    });
  });

  it('propagates 401 as KomootError', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('', { status: 401 })
    ) as unknown as typeof fetch;
    await expect(
      listTours({ email: 'a@b.c', token: 'X' }, { userId: '1', page: 0 })
    ).rejects.toMatchObject({ name: 'KomootError', status: 401 });
  });
});

describe('komoot.getTour', () => {
  beforeEach(() => vi.stubEnv('KOMOOT_BASE_URL', 'https://api.komoot.de'));
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    vi.unstubAllEnvs();
  });

  it('GETs /v007/tours/{id} and returns mapped metadata', async () => {
    const body = fixture('tour.json');
    globalThis.fetch = vi.fn(async (url: string) => {
      expect(url).toBe('https://api.komoot.de/v007/tours/111');
      return new Response(body, {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }) as unknown as typeof fetch;

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
  beforeEach(() => vi.stubEnv('KOMOOT_BASE_URL', 'https://api.komoot.de'));
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    vi.unstubAllEnvs();
  });

  it('GETs /v007/tours/{id}/coordinates and converts t (ms-offset) to ISO using start time', async () => {
    const body = fixture('coordinates.json');
    globalThis.fetch = vi.fn(async (url: string) => {
      expect(url).toBe('https://api.komoot.de/v007/tours/111/coordinates');
      return new Response(body, {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }) as unknown as typeof fetch;

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

  it('returns empty list when items missing', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    ) as unknown as typeof fetch;

    const coords = await getCoordinates(
      { email: 'a@b.c', token: 'T' },
      '111',
      '2026-01-01T00:00:00Z'
    );
    expect(coords).toEqual([]);
  });
});

// keep KomootError importable in test file (used as type guard)
void KomootError;
