import type { Provider, ProviderSession, ActivityPage, ActivityDetail } from '../provider';
import {
  listActivities, listRoutes, getStreamCoordinates, getActivityName, getGpx,
  getRouteDetail, getRouteGpx
} from '../strava';
import { nativeStravaLogin, nativeLogout } from '../strava-auth';
import { parseStravaId } from '../strava-id';

export const stravaProvider: Provider = {
  id: 'strava',
  label: 'Strava',
  capabilities: {
    // Routes first → it's the default landing filter (planned routes are the
    // primary thing you export to navigate on a device).
    filters: [
      { id: 'routes', label: 'Routes' },
      { id: 'activities', label: 'Activities' }
    ]
  },

  async login(): Promise<ProviderSession> {
    const r = await nativeStravaLogin();
    return {
      provider: 'strava',
      userId: r.userId,
      displayName: r.displayName || 'Strava athlete',
      // No portable token — the session cookie lives in the native CookieManager.
      token: r.token || 'web-session'
    };
  },

  async listActivities(_session, opts): Promise<ActivityPage> {
    return (opts.filter ?? 'routes') === 'activities'
      ? listActivities(opts.page, 'activities')
      : listRoutes(opts.page);
  },

  async getActivity(_session, id): Promise<ActivityDetail> {
    const { type, rawId } = parseStravaId(id);
    if (type === 'route') {
      const { name, coords } = await getRouteDetail(rawId);
      return { meta: { id, name: name || `Route ${rawId}`, sport: 'Route', date: '' }, preview: coords };
    }
    const [coords, name] = await Promise.all([getStreamCoordinates(rawId), getActivityName(rawId)]);
    return { meta: { id, name: name || `Strava activity ${rawId}`, sport: '', date: '' }, preview: coords };
  },

  async getGpx(_session, id): Promise<string> {
    const { type, rawId } = parseStravaId(id);
    return type === 'route' ? getRouteGpx(rawId) : getGpx(rawId);
  },

  async logout(): Promise<void> {
    await nativeLogout();
  }
};
