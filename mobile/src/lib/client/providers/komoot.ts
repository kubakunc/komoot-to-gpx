import type {
  Provider, ProviderSession, ActivityPage, ActivityDetail, ActivityMeta, ActivitySummary
} from '../provider';
import { listTours, getTour, getCoordinates, onTokenRefreshed, type Coordinate, type TourSummary, type TourFilter } from '../komoot';
import { nativeLogin, nativeLogout } from '../komoot-auth';
import { setProviderSession } from '../session';
import { toGpx } from '../gpx';

function toSummary(t: TourSummary): ActivitySummary {
  return {
    id: t.id,
    name: t.name,
    sport: t.sport,
    distance: t.distance,
    date: t.date,
    kind: t.type === 'tour_planned' ? 'planned' : 'recorded',
    status: t.status
  };
}

// Cache of the last activity detail, so an export straight after viewing it
// doesn't re-fetch the tour + coordinates.
let lastDetail: { id: string; meta: ActivityMeta; coords: Coordinate[] } | null = null;

// Persist the refreshed token against the session whose call triggered it.
let currentSession: ProviderSession | null = null;
onTokenRefreshed((token) => {
  if (currentSession) {
    currentSession = { ...currentSession, token };
    void setProviderSession(currentSession);
  }
});

export const komootProvider: Provider = {
  id: 'komoot',
  label: 'Komoot',
  capabilities: {
    filters: [
      { id: 'all', label: 'All' },
      { id: 'recorded', label: 'Completed' },
      { id: 'planned', label: 'Planned' }
    ]
  },

  async login(): Promise<ProviderSession> {
    const { userId, token, email } = await nativeLogin();
    return { provider: 'komoot', userId, displayName: email, token };
  },

  async listActivities(session, opts): Promise<ActivityPage> {
    currentSession = session;
    const filter = (opts.filter ?? 'all') as TourFilter;
    const data = await listTours(
      { email: session.displayName, token: session.token },
      { userId: session.userId, page: opts.page, filter }
    );
    return { items: data.tours.map(toSummary), page: data.page, totalPages: data.totalPages };
  },

  async getActivity(session, id): Promise<ActivityDetail> {
    currentSession = session;
    const auth = { email: session.displayName, token: session.token };
    const meta = await getTour(auth, id);
    const coords = await getCoordinates(auth, id, meta.date);
    // Full-resolution track; the list downsamples for the card thumbnail, the
    // detail screen uses the full set for the map and distance/elevation stats.
    const detailMeta = { id: meta.id, name: meta.name, sport: meta.sport, date: meta.date };
    lastDetail = { id, meta: detailMeta, coords }; // reused by getGpx (export from detail)
    return { meta: detailMeta, preview: coords };
  },

  async getGpx(session, id): Promise<string> {
    currentSession = session;
    // Exporting from the detail screen immediately follows getActivity for the
    // same id — reuse that fetch instead of hitting the API twice.
    if (lastDetail && lastDetail.id === id) {
      const m = lastDetail.meta;
      return toGpx({ name: m.name, sport: m.sport, startTimeIso: m.date }, lastDetail.coords);
    }
    const auth = { email: session.displayName, token: session.token };
    const meta = await getTour(auth, id);
    const coords = await getCoordinates(auth, id, meta.date);
    return toGpx({ name: meta.name, sport: meta.sport, startTimeIso: meta.date }, coords);
  },

  async logout(): Promise<void> {
    await nativeLogout();
  }
};
