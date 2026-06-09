import { Preferences } from '@capacitor/preferences';
import type { ProviderId, ProviderSession } from './provider';

const LEGACY_KEY = 'gpx-exporter:session';
const keyFor = (p: ProviderId) => `gpx-exporter:session:${p}`;
const ALL: ProviderId[] = ['komoot', 'strava'];

/** Legacy shape kept for backward-compatible wrappers. */
export interface Session {
  email: string;
  userId: string;
  token: string;
}

function isValid(s: Partial<ProviderSession> | null): s is ProviderSession {
  return !!s && !!s.provider && !!s.userId && !!s.token;
}

/** One-time migration of the old single-session key into the Komoot slot. */
async function migrateLegacy(): Promise<void> {
  const { value } = await Preferences.get({ key: LEGACY_KEY });
  if (!value) return;
  try {
    const old = JSON.parse(value) as Session;
    if (old.email && old.userId && old.token) {
      const migrated: ProviderSession = {
        provider: 'komoot', userId: old.userId, displayName: old.email, token: old.token
      };
      await Preferences.set({ key: keyFor('komoot'), value: JSON.stringify(migrated) });
    }
  } catch {
    /* corrupted legacy value — drop it */
  }
  await Preferences.remove({ key: LEGACY_KEY });
}

export async function getProviderSession(provider: ProviderId): Promise<ProviderSession | null> {
  if (provider === 'komoot') await migrateLegacy();
  const { value } = await Preferences.get({ key: keyFor(provider) });
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as ProviderSession;
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function setProviderSession(s: ProviderSession): Promise<void> {
  await Preferences.set({ key: keyFor(s.provider), value: JSON.stringify(s) });
}

export async function clearProviderSession(provider: ProviderId): Promise<void> {
  await Preferences.remove({ key: keyFor(provider) });
}

export async function getConnectedProviders(): Promise<ProviderId[]> {
  const out: ProviderId[] = [];
  for (const p of ALL) {
    if (await getProviderSession(p)) out.push(p);
  }
  return out;
}

// ---- Legacy compatibility wrappers (Komoot slot) -------------------------
// Existing pages call these; they keep working unchanged until the UI is
// rewired to the provider abstraction.

export async function getSession(): Promise<Session | null> {
  const s = await getProviderSession('komoot');
  return s ? { email: s.displayName, userId: s.userId, token: s.token } : null;
}

export async function setSession(s: Session): Promise<void> {
  await setProviderSession({
    provider: 'komoot', userId: s.userId, displayName: s.email, token: s.token
  });
}

export async function clearSession(): Promise<void> {
  await clearProviderSession('komoot');
}

export function authHeader(s: Session): string {
  return 'Basic ' + btoa(`${s.email}:${s.token}`);
}
