import { CapacitorHttp } from '@capacitor/core';

const BASE = 'https://api.komoot.de';
const ACCEPT = 'application/hal+json,application/json';

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

const basic = (email: string, secret: string) => 'Basic ' + btoa(`${email}:${secret}`);

function failIfNotOk(status: number, label: string): void {
  if (status >= 200 && status < 300) return;
  const mapped = status >= 500 ? 502 : status;
  throw new KomootError(`${label} failed (komoot returned ${status})`, mapped);
}

interface AccountResponse {
  username: string;
  password: string;
  email: string;
}

export async function loginWithCookies(
  cookieHeader: string
): Promise<{ userId: string; token: string; email: string }> {
  const res = await CapacitorHttp.request({
    method: 'GET',
    url: `${BASE}/v006/account/`,
    headers: { Cookie: cookieHeader, Accept: ACCEPT }
  });
  failIfNotOk(res.status, 'loginWithCookies');
  const body = res.data as AccountResponse;
  if (!body.username || !body.password) {
    throw new KomootError('loginWithCookies: unexpected response shape', 502);
  }
  return { userId: body.username, token: body.password, email: body.email };
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

export async function listTours(
  auth: KomootAuth,
  opts: { userId: string; page: number; limit?: number }
): Promise<ToursPage> {
  const limit = opts.limit ?? 24;
  const qs = new URLSearchParams({
    type: 'tour_recorded,tour_planned',
    page: String(opts.page),
    limit: String(limit)
  });
  const res = await CapacitorHttp.request({
    method: 'GET',
    url: `${BASE}/v007/users/${encodeURIComponent(opts.userId)}/tours/?${qs}`,
    headers: { Authorization: basic(auth.email, auth.token), Accept: ACCEPT }
  });
  failIfNotOk(res.status, 'listTours');
  const body = res.data as ToursResponse;
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
  const res = await CapacitorHttp.request({
    method: 'GET',
    url: `${BASE}/v007/tours/${encodeURIComponent(tourId)}`,
    headers: { Authorization: basic(auth.email, auth.token), Accept: ACCEPT }
  });
  failIfNotOk(res.status, 'getTour');
  const raw = res.data as Record<string, unknown>;
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
  const res = await CapacitorHttp.request({
    method: 'GET',
    url: `${BASE}/v007/tours/${encodeURIComponent(tourId)}/coordinates`,
    headers: { Authorization: basic(auth.email, auth.token), Accept: ACCEPT }
  });
  failIfNotOk(res.status, 'getCoordinates');
  const body = res.data as { items?: Array<Record<string, unknown>> };
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
