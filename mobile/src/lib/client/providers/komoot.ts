import type {
  Provider, ProviderSession, ActivityPage, ActivityDetail, ActivityFilter, ActivitySummary
} from '../provider';
import { listTours, getTour, getCoordinates, downsample, type TourSummary } from '../komoot';
import { nativeLogin } from '../komoot-auth';
import { toGpx } from '../gpx';

const PREVIEW_POINTS = 160;

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

export const komootProvider: Provider = {
  id: 'komoot',
  label: 'Komoot',
  capabilities: { planned: true },

  async login(): Promise<ProviderSession> {
    const { userId, token, email } = await nativeLogin();
    return { provider: 'komoot', userId, displayName: email, token };
  },

  async listActivities(session, opts): Promise<ActivityPage> {
    const filter: ActivityFilter = opts.filter ?? 'all';
    const data = await listTours(
      { email: session.displayName, token: session.token },
      { userId: session.userId, page: opts.page, filter }
    );
    return { items: data.tours.map(toSummary), page: data.page, totalPages: data.totalPages };
  },

  async getActivity(session, id): Promise<ActivityDetail> {
    const auth = { email: session.displayName, token: session.token };
    const meta = await getTour(auth, id);
    const coords = await getCoordinates(auth, id, meta.date);
    return {
      meta: { id: meta.id, name: meta.name, sport: meta.sport, date: meta.date },
      preview: downsample(coords, PREVIEW_POINTS)
    };
  },

  async getGpx(session, id): Promise<string> {
    const auth = { email: session.displayName, token: session.token };
    const meta = await getTour(auth, id);
    const coords = await getCoordinates(auth, id, meta.date);
    return toGpx({ name: meta.name, sport: meta.sport, startTimeIso: meta.date }, coords);
  }
};
