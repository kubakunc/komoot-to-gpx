import { Preferences } from '@capacitor/preferences';
import type { ProviderId } from './provider';

const PENDING_KEY = 'gpx-exporter:pending-share-tour';
/** Written by the native share handler (MainActivity) — the cold-start-safe channel. */
const NATIVE_TOKEN_KEY = 'gpx-exporter:native-share-token';
const TOUR_REGEX = /komoot\.(?:com|de)\/(?:[^/?#\s]+\/)?tour\/(\d+)/i;

/** A shared item to open: which provider, and the (namespaced for Strava) id. */
export interface ShareTarget {
  provider: ProviderId;
  id: string;
}

export function extractTourId(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = TOUR_REGEX.exec(text);
  return m ? m[1] : null;
}

export function readShareHash(hash: string): ShareTarget | null {
  const m = /^#share=(komoot|strava):([A-Za-z0-9-]+)$/.exec(hash);
  if (m) return { provider: m[1] as ProviderId, id: m[2] };
  const legacy = /^#share-tour=(\d+)$/.exec(hash);
  if (legacy) return { provider: 'komoot', id: legacy[1] };
  return null;
}

function parseShareToken(token: string): ShareTarget | null {
  const m = /^(komoot|strava):([A-Za-z0-9-]+)$/.exec(token);
  return m ? { provider: m[1] as ProviderId, id: m[2] } : null;
}

/**
 * Read (and clear) the share token the native layer persisted to Preferences.
 * This is the cold-start-safe path: unlike a URL hash, it survives the WebView
 * finishing its load and SvelteKit normalising the URL.
 */
export async function consumeNativeShareToken(): Promise<ShareTarget | null> {
  let value: string | null = null;
  try {
    value = (await Preferences.get({ key: NATIVE_TOKEN_KEY })).value;
  } catch {
    return null;
  }
  if (!value) return null;
  await clearNativeShareToken();
  return parseShareToken(value);
}

/** Clear the native token so it can't replay on a later cold start. */
export async function clearNativeShareToken(): Promise<void> {
  try {
    await Preferences.remove({ key: NATIVE_TOKEN_KEY });
  } catch {
    /* best effort */
  }
}

export function setPendingShare(target: ShareTarget): void {
  localStorage.setItem(PENDING_KEY, JSON.stringify(target));
}

/** Read the pending share without clearing it (e.g. to show a hint on /login). */
export function peekPendingShare(): ShareTarget | null {
  const v = localStorage.getItem(PENDING_KEY);
  if (!v) return null;
  try {
    const t = JSON.parse(v) as ShareTarget;
    if ((t.provider === 'komoot' || t.provider === 'strava') && t.id) return t;
  } catch {
    /* corrupt */
  }
  return null;
}

export function consumePendingShare(): ShareTarget | null {
  const t = peekPendingShare();
  localStorage.removeItem(PENDING_KEY);
  return t;
}

const VIA_SHARE_KEY = 'gpx-exporter:via-share-tour';

/** Remember that this tour was opened via the share intent (for analytics). */
export function markViaShare(tourId: string): void {
  sessionStorage.setItem(VIA_SHARE_KEY, tourId);
}

/** True if the given tour arrived via the share intent. Does not clear. */
export function wasViaShare(tourId: string): boolean {
  return sessionStorage.getItem(VIA_SHARE_KEY) === tourId;
}
