import { KomootError } from './komoot';
import { StravaError } from './strava';

/**
 * True only for a genuine 401 (expired/invalid session) from either provider.
 * A 403 (permission/CSRF) or any other status must NOT be treated as auth
 * failure — otherwise a routes/CSRF hiccup would sign the user out.
 */
export function isProviderAuthError(e: unknown): boolean {
  return (e instanceof KomootError && e.status === 401) || (e instanceof StravaError && e.status === 401);
}
