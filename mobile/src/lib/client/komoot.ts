import { registerPlugin } from '@capacitor/core';

interface KomootApiPlugin {
  get(opts: { path: string; token: string }): Promise<{ status: number; body: string }>;
}

const KomootApi = registerPlugin<KomootApiPlugin>('KomootApi');

export class KomootError extends Error {
  readonly name = 'KomootError';
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export interface KomootAuth {
  email: string;
  token: string;
}

async function apiGet<T>(path: string, token: string, label: string): Promise<T> {
  const { status, body } = await KomootApi.get({ path, token });
  if (status < 200 || status >= 300) {
    const mapped = status >= 500 ? 502 : status;
    throw new KomootError(`${label} failed (komoot returned ${status})`, mapped);
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new KomootError(`${label}: invalid JSON response`, 502);
  }
}

export interface TourSummary {
  id: string;
  name: string;
  sport: string;
  distance: number;
  date: string;
  status: 'public' | 'private' | string;
  type: 'tour_recorded' | 'tour_planned' | string;
}

export interface ToursPage {
  tours: TourSummary[];
  page: number;
  totalPages: number;
}

interface ToursResponse {
  _embedded?: { tours?: Array<Record<string, unknown>> };
  page?: { number: number; totalPages: number };
}

function toSummary(raw: Record<string, unknown>): TourSummary {
  return {
    id: String(raw.id),
    name: String(raw.name ?? 'untitled'),
    sport: String(raw.sport ?? 'unknown'),
    distance: Number(raw.distance ?? 0),
    date: String(raw.date ?? ''),
    status: String(raw.status ?? 'private'),
    type: String(raw.type ?? 'tour_recorded')
  };
}

export type TourFilter = 'all' | 'recorded' | 'planned';

export async function listTours(
  auth: KomootAuth,
  opts: { userId: string; page: number; limit?: number; filter?: TourFilter }
): Promise<ToursPage> {
  const limit = opts.limit ?? 24;
  const filter = opts.filter ?? 'all';
  const typeParam =
    filter === 'recorded' ? 'tour_recorded'
    : filter === 'planned' ? 'tour_planned'
    : 'tour_recorded,tour_planned';
  const qs = new URLSearchParams({
    type: typeParam,
    page: String(opts.page),
    limit: String(limit)
  });
  const body = await apiGet<ToursResponse>(
    `/v007/users/${encodeURIComponent(opts.userId)}/tours/?${qs}`,
    auth.token,
    'listTours'
  );
  return {
    tours: (body._embedded?.tours ?? []).map(toSummary),
    page: body.page?.number ?? opts.page,
    totalPages: body.page?.totalPages ?? 1
  };
}

export interface TourMetadata {
  id: string;
  name: string;
  sport: string;
  date: string;
}

export async function getTour(auth: KomootAuth, tourId: string): Promise<TourMetadata> {
  const raw = await apiGet<Record<string, unknown>>(
    `/v007/tours/${encodeURIComponent(tourId)}`,
    auth.token,
    'getTour'
  );
  return {
    id: String(raw.id),
    name: String(raw.name ?? 'untitled'),
    sport: String(raw.sport ?? 'unknown'),
    date: String(raw.date ?? '')
  };
}

export interface Coordinate {
  lat: number;
  lng: number;
  alt?: number;
  t?: string;
}

export async function getCoordinates(
  auth: KomootAuth,
  tourId: string,
  startTimeIso: string
): Promise<Coordinate[]> {
  const body = await apiGet<{ items?: Array<Record<string, unknown>> }>(
    `/v007/tours/${encodeURIComponent(tourId)}/coordinates`,
    auth.token,
    'getCoordinates'
  );
  if (!body.items) return [];
  const start = Date.parse(startTimeIso);
  return body.items.map((p) => {
    const c: Coordinate = { lat: Number(p.lat), lng: Number(p.lng) };
    if (p.alt !== undefined) c.alt = Number(p.alt);
    if (p.t !== undefined && Number.isFinite(start)) {
      c.t = new Date(start + Number(p.t)).toISOString();
    }
    return c;
  });
}

export function downsample<T>(arr: T[], target: number): T[] {
  if (arr.length <= target) return arr;
  const step = (arr.length - 1) / (target - 1);
  const out: T[] = [];
  for (let i = 0; i < target; i++) {
    out.push(arr[Math.round(i * step)]);
  }
  return out;
}
