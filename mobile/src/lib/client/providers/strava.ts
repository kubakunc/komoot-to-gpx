import type { Provider, ProviderSession, ActivityPage, ActivityDetail } from '../provider';
import { listActivities, getStreamCoordinates, getActivityName, getGpx } from '../strava';
import { downsample } from '../komoot';
import { nativeStravaLogin } from '../strava-auth';

const PREVIEW_POINTS = 160;

export const stravaProvider: Provider = {
  id: 'strava',
  label: 'Strava',
  capabilities: { planned: false },

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
    return listActivities(opts.page, opts.filter ?? 'all');
  },

  async getActivity(_session, id): Promise<ActivityDetail> {
    const [coords, name] = await Promise.all([getStreamCoordinates(id), getActivityName(id)]);
    return {
      meta: { id, name: name || `Strava activity ${id}`, sport: '', date: '' },
      preview: downsample(coords, PREVIEW_POINTS)
    };
  },

  async getGpx(_session, id): Promise<string> {
    return getGpx(id);
  }
};
