import { registerPlugin } from '@capacitor/core';
import type { ActivityPage, ActivityFilter } from './provider';
import type { Coordinate } from './komoot';
import { parseActivityList, parseRouteList, streamsToCoordinates } from './providers/strava-map';
import { parseGpxTrack } from './strava-gpx';

interface StravaApiPlugin {
  /** Cookie-replay GET against https://www.strava.com (native adds the session cookie). */
  get(opts: { path: string }): Promise<{ status: number; body: string }>;
  /** Cookie-replay POST with a JSON body; native attaches the scraped CSRF token. */
  post(opts: { path: string; body: string }): Promise<{ status: number; body: string }>;
}

const StravaApi = registerPlugin<StravaApiPlugin>('StravaApi');

export class StravaError extends Error {
  readonly name = 'StravaError';
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const PER_PAGE = 20;

async function get(path: string, label: string): Promise<{ status: number; body: string }> {
  const r = await StravaApi.get({ path });
  // Only a genuine auth bounce (native maps a login redirect to 401) clears the
  // session. A 403 is a permission/CSRF issue, NOT an expired session.
  if (r.status === 401) {
    throw new StravaError(`${label}: not authenticated`, 401);
  }
  return r;
}

export async function listActivities(page: number, _filter: ActivityFilter): Promise<ActivityPage> {
  // Strava exposes only recorded activities; the filter is ignored here and the
  // Planned chip is hidden in the UI via capabilities.planned === false.
  const { status, body } = await get(
    `/athlete/training_activities?per_page=${PER_PAGE}&page=${page + 1}`,
    'listActivities'
  );
  if (status < 200 || status >= 300) {
    throw new StravaError(`listActivities failed (${status})`, status >= 500 ? 502 : status);
  }
  return parseActivityList(body, page, PER_PAGE);
}

export async function getStreamCoordinates(id: string): Promise<Coordinate[]> {
  const { status, body } = await get(
    `/activities/${encodeURIComponent(id)}/streams?stream_types%5B%5D=latlng&stream_types%5B%5D=altitude`,
    'getStreams'
  );
  if (status < 200 || status >= 300) return [];
  return streamsToCoordinates(body);
}

const ROUTE_TYPES = [
  'Ride', 'Run', 'Walk', 'Hike', 'TrailRun', 'GravelRide', 'MountainBikeRide',
  'EMountainBikeRide', 'EBikeRide', 'Swim', 'NordicSki', 'AlpineSki', 'Snowshoe',
  'Kayak', 'Canoe', 'Rowing', 'StandUpPaddle', 'Handcycle', 'Wheelchair', 'Velomobile'
];

export async function listRoutes(page: number): Promise<ActivityPage> {
  const body = JSON.stringify({
    pageSize: PER_PAGE,
    after: String(page * PER_PAGE),
    searchArgs: {
      query: '', onlyStarred: false, createdBy: 'Any',
      routeTypes: ROUTE_TYPES,
      elevGainMin: 0, elevGainMax: null, distanceMin: 0, distanceMax: null
    },
    resolutions: [{ height: 192, width: 280, isRetina: true }]
  });
  const r = await StravaApi.post({ path: '/api/next/data/routes/my-routes', body });
  if (r.status === 401) throw new StravaError('listRoutes: not authenticated', 401);
  if (r.status < 200 || r.status >= 300) {
    // 403/CSRF and other failures surface as a load error — they must NOT sign the user out.
    throw new StravaError(`listRoutes failed (${r.status})`, r.status >= 500 ? 502 : r.status);
  }
  return parseRouteList(r.body, page, PER_PAGE);
}

export async function getRouteGpx(rawId: string): Promise<string> {
  const { status, body } = await get(`/routes/${encodeURIComponent(rawId)}/export_gpx`, 'route_export_gpx');
  if (status < 200 || status >= 300) {
    throw new StravaError(`route export_gpx failed (${status})`, status >= 500 ? 502 : status);
  }
  if (!body.trimStart().startsWith('<')) throw new StravaError('No GPS track for this route', 422);
  return body;
}

/** Routes carry no coordinates in the list; derive them (and the name) from the route GPX. */
export async function getRouteDetail(rawId: string): Promise<{ name: string; coords: Coordinate[] }> {
  return parseGpxTrack(await getRouteGpx(rawId));
}

export async function getActivityName(id: string): Promise<string> {
  try {
    const { status, body } = await get(`/activities/${encodeURIComponent(id)}`, 'getActivityName');
    if (status < 200 || status >= 300) return '';
    const m = /<title>([^<]+)<\/title>/i.exec(body);
    if (!m) return '';
    return m[1].replace(/\s*[|·]\s*Strava\s*$/i, '').trim();
  } catch {
    return '';
  }
}

export async function getGpx(id: string): Promise<string> {
  const { status, body } = await get(
    `/activities/${encodeURIComponent(id)}/export_gpx`,
    'export_gpx'
  );
  if (status < 200 || status >= 300) {
    throw new StravaError(`export_gpx failed (${status})`, status >= 500 ? 502 : status);
  }
  if (!body.trimStart().startsWith('<')) {
    throw new StravaError('No GPS track for this activity', 422);
  }
  return body;
}
