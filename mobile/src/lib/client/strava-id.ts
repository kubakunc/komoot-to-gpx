export type StravaItemType = 'activity' | 'route';

export function stravaId(type: StravaItemType, rawId: string): string {
  return `${type}-${rawId}`;
}

export function parseStravaId(id: string): { type: StravaItemType; rawId: string } {
  if (id.startsWith('route-')) return { type: 'route', rawId: id.slice('route-'.length) };
  if (id.startsWith('activity-')) return { type: 'activity', rawId: id.slice('activity-'.length) };
  return { type: 'activity', rawId: id }; // bare id ⇒ activity
}
