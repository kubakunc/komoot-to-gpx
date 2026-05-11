import { Preferences } from '@capacitor/preferences';

const KEY = 'gpx-exporter:session';

export interface Session {
  email: string;
  userId: string;
  token: string;
}

export async function getSession(): Promise<Session | null> {
  const { value } = await Preferences.get({ key: KEY });
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Session;
    if (parsed.email && parsed.userId && parsed.token) return parsed;
  } catch {
    /* corrupted */
  }
  return null;
}

export async function setSession(s: Session): Promise<void> {
  await Preferences.set({ key: KEY, value: JSON.stringify(s) });
}

export async function clearSession(): Promise<void> {
  await Preferences.remove({ key: KEY });
}

export function authHeader(s: Session): string {
  return 'Basic ' + btoa(`${s.email}:${s.token}`);
}
