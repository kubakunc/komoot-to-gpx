const DEFAULT_BASE = 'https://api.komoot.de';
const USER_AGENT = 'komoot-to-gpx/0.1';

const baseUrl = () => process.env.KOMOOT_BASE_URL ?? DEFAULT_BASE;

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

interface AccountResponse {
  username: string;
  password: string;
  email: string;
}

const basic = (email: string, secret: string) =>
  'Basic ' + Buffer.from(`${email}:${secret}`).toString('base64');

const headers = (auth: string) => ({
  Authorization: auth,
  'User-Agent': USER_AGENT,
  Accept: 'application/json'
});

async function call(path: string, auth: string): Promise<Response> {
  return fetch(`${baseUrl()}${path}`, {
    method: 'GET',
    headers: headers(auth)
  });
}

function failIfNotOk(res: Response, label: string): void {
  if (res.ok) return;
  const status = res.status >= 500 ? 502 : res.status;
  throw new KomootError(`${label} failed (komoot returned ${res.status})`, status);
}

export async function login(
  email: string,
  password: string
): Promise<{ userId: string; token: string; email: string }> {
  const path = `/v006/account/email/${encodeURIComponent(email)}/`;
  const res = await call(path, basic(email, password));
  failIfNotOk(res, 'login');
  const body = (await res.json()) as AccountResponse;
  if (!body.username || !body.password) {
    throw new KomootError('login: unexpected response shape', 502);
  }
  return { userId: body.username, token: body.password, email };
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
  const path = `/v007/users/${encodeURIComponent(opts.userId)}/tours/?${qs}`;
  const res = await call(path, basic(auth.email, auth.token));
  failIfNotOk(res, 'listTours');
  const body = (await res.json()) as ToursResponse;
  const tours = (body._embedded?.tours ?? []).map(toSummary);
  return {
    tours,
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
  const path = `/v007/tours/${encodeURIComponent(tourId)}`;
  const res = await call(path, basic(auth.email, auth.token));
  failIfNotOk(res, 'getTour');
  const raw = (await res.json()) as Record<string, unknown>;
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
  const path = `/v007/tours/${encodeURIComponent(tourId)}/coordinates`;
  const res = await call(path, basic(auth.email, auth.token));
  failIfNotOk(res, 'getCoordinates');
  const body = (await res.json()) as { items?: Array<Record<string, unknown>> };
  if (!body.items) return [];
  const start = Date.parse(startTimeIso);
  return body.items.map((p) => {
    const c: Coordinate = {
      lat: Number(p.lat),
      lng: Number(p.lng)
    };
    if (p.alt !== undefined) c.alt = Number(p.alt);
    if (p.t !== undefined && Number.isFinite(start)) {
      c.t = new Date(start + Number(p.t)).toISOString();
    }
    return c;
  });
}
