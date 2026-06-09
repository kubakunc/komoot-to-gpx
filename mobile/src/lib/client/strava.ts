import { registerPlugin } from '@capacitor/core';
import type { ActivityPage, ActivityFilter } from './provider';
import type { Coordinate } from './komoot';
import { parseActivityList, latlngToCoordinates } from './providers/strava-map';

interface StravaApiPlugin {
  /** Cookie-replay GET against https://www.strava.com (native adds the session cookie). */
  get(opts: { path: string }): Promise<{ status: number; body: string }>;
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
  // A logged-out session bounces to the login page (302/200-HTML); the native
  // side maps an auth bounce to 401 so the UI can clear the session.
  if (r.status === 401 || r.status === 403) {
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
    `/activities/${encodeURIComponent(id)}/streams?stream_types%5B%5D=latlng`,
    'getStreams'
  );
  if (status < 200 || status >= 300) return [];
  return latlngToCoordinates(body);
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
