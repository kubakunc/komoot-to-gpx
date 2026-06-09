import type { Coordinate } from './komoot';

export type ProviderId = 'komoot' | 'strava';

/** Persisted, provider-tagged auth state. Replaces the legacy single Session. */
export interface ProviderSession {
  provider: ProviderId;
  userId: string;
  displayName: string; // email (Komoot) or athlete name (Strava)
  token: string;       // long-lived JWT (Komoot) / session marker (Strava)
}

export type ActivityFilter = string;

export interface ProviderFilter {
  id: string;
  label: string;
}

export interface ActivitySummary {
  id: string;
  name: string;
  sport: string;
  distance: number;
  date: string;
  kind: 'recorded' | 'planned';
  status?: string; // optional visibility/privacy label for the UI badge
}

export interface ActivityPage {
  items: ActivitySummary[];
  page: number;
  totalPages: number;
}

export interface ActivityMeta {
  id: string;
  name: string;
  sport: string;
  date: string;
}

export interface ActivityDetail {
  meta: ActivityMeta;
  preview: Coordinate[];
}

export interface Provider {
  readonly id: ProviderId;
  readonly label: string;
  readonly capabilities: { filters: ProviderFilter[] };
  login(): Promise<ProviderSession>;
  listActivities(
    session: ProviderSession,
    opts: { page: number; filter?: ActivityFilter }
  ): Promise<ActivityPage>;
  getActivity(session: ProviderSession, id: string): Promise<ActivityDetail>;
  getGpx(session: ProviderSession, id: string): Promise<string>;
}
