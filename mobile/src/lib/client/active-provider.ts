import { writable } from 'svelte/store';
import type { ProviderId } from './provider';

const KEY = 'gpx-exporter:active-provider';

function read(): ProviderId {
  // localStorage (not sessionStorage): the choice must survive the WebView
  // process being killed, otherwise a Strava-first user resets to Komoot on
  // every cold start.
  if (typeof localStorage === 'undefined') return 'komoot';
  const v = localStorage.getItem(KEY);
  return v === 'strava' || v === 'komoot' ? v : 'komoot';
}

/** Reactive active source; components subscribe to react to switches. */
export const activeProvider = writable<ProviderId>(read());

/** Non-reactive read for one-shot callers (e.g. the detail page on mount). */
export function getActiveProvider(): ProviderId {
  return read();
}

export function setActiveProvider(id: ProviderId): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* localStorage unavailable — fall back to the default on next read */
  }
  activeProvider.set(id);
}

/**
 * The effective active source: the requested one if it's connected, otherwise
 * the first connected provider. When nothing is connected, returns the request
 * unchanged (the caller redirects to /login).
 */
export function resolveActiveProvider(connected: ProviderId[], requested: ProviderId): ProviderId {
  if (connected.length === 0) return requested;
  return connected.includes(requested) ? requested : connected[0];
}
