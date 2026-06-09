export type StravaItemType = 'activity' | 'route';

export function stravaId(type: StravaItemType, rawId: string): string {
  return `${type}-${rawId}`;
}

export function parseStravaId(id: string): { type: StravaItemType; rawId: string } {
  if (id.startsWith('route-')) return { type: 'route', rawId: id.slice('route-'.length) };
  if (id.startsWith('activity-')) return { type: 'activity', rawId: id.slice('activity-'.length) };
  return { type: 'activity', rawId: id }; // bare id ⇒ activity
}

/** The public strava.com URL for a namespaced Strava id (route vs activity). */
export function stravaWebUrl(id: string): string {
  const { type, rawId } = parseStravaId(id);
  return type === 'route'
    ? `https://www.strava.com/routes/${rawId}`
    : `https://www.strava.com/activities/${rawId}`;
}
