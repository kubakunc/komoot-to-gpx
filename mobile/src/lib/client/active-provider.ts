import type { ProviderId } from './provider';

const KEY = 'gpx-exporter:active-provider';

/** The source the list/detail screens are currently showing. Defaults to Komoot. */
export function getActiveProvider(): ProviderId {
  if (typeof sessionStorage === 'undefined') return 'komoot';
  const v = sessionStorage.getItem(KEY);
  return v === 'strava' || v === 'komoot' ? v : 'komoot';
}

export function setActiveProvider(id: ProviderId): void {
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    /* sessionStorage unavailable — fall back to the default on next read */
  }
}
