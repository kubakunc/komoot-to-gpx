const KEY = 'komoot-to-gpx:session';

export interface Session {
  email: string;
  userId: string;
  token: string;
}

export function getSession(): Session | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (parsed.email && parsed.userId && parsed.token) return parsed;
  } catch {
    /* ignore malformed */
  }
  return null;
}

export function setSession(s: Session): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession(): void {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY);
}

export function authHeader(s: Session): string {
  return 'Basic ' + btoa(`${s.email}:${s.token}`);
}
