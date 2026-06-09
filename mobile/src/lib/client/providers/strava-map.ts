import type { ActivitySummary, ActivityPage } from '../provider';
import type { Coordinate } from '../komoot';

/** Subset of the fields Strava's training_activities rows expose. */
export interface StravaActivityModel {
  id: number | string;
  name?: string;
  sport_type?: string;
  display_type?: string;
  start_time?: string;
  distance_raw?: number;
  has_latlng?: boolean;
  private?: boolean;
  visibility?: string;
}

const SPORT_LABEL: Record<string, string> = {
  Ride: 'Ride', Run: 'Run', Hike: 'Hike', Walk: 'Walk', Swim: 'Swim',
  VirtualRide: 'Virtual Ride', EBikeRide: 'E-Bike', GravelRide: 'Gravel',
  MountainBikeRide: 'MTB', TrailRun: 'Trail Run', Workout: 'Workout'
};

function mapSport(s?: string): string {
  if (!s) return 'activity';
  return SPORT_LABEL[s] ?? s.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function toActivitySummary(m: StravaActivityModel): ActivitySummary {
  const status = m.private
    ? 'private'
    : m.visibility === 'everyone'
      ? 'public'
      : (m.visibility ?? 'private');
  return {
    id: String(m.id),
    name: m.name ?? 'Untitled',
    sport: mapSport(m.sport_type),
    distance: Number(m.distance_raw ?? 0),
    date: m.start_time ?? '',
    kind: 'recorded',
    status
  };
}

/**
 * Parse a training_activities response. Strava gives no total-page count, so we
 * infer one more page exists whenever a full page came back.
 */
export function parseActivityList(body: string, page: number, perPage: number): ActivityPage {
  let models: StravaActivityModel[] = [];
  try {
    const d = JSON.parse(body);
    models = Array.isArray(d) ? d : (d.models ?? []);
  } catch {
    models = [];
  }
  const items = models.map(toActivitySummary);
  const totalPages = items.length >= perPage ? page + 2 : page + 1;
  return { items, page, totalPages };
}

/** Parse the streams `{ latlng: [[lat,lng],...], altitude?: [m,...] }` response. */
export function streamsToCoordinates(body: string): Coordinate[] {
  try {
    const d = JSON.parse(body);
    const ll: unknown = d?.latlng;
    if (!Array.isArray(ll)) return [];
    const alt: unknown = d?.altitude;
    const altArr = Array.isArray(alt) ? alt : null;
    return ll
      .filter((p): p is [number, number] => Array.isArray(p) && p.length >= 2)
      .map((p, i) => {
        const c: Coordinate = { lat: Number(p[0]), lng: Number(p[1]) };
        if (altArr && altArr[i] != null) c.alt = Number(altArr[i]);
        return c;
      });
  } catch {
    return [];
  }
}
