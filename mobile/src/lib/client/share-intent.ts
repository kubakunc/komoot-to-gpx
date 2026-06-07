const PENDING_KEY = 'gpx-exporter:pending-share-tour';
const TOUR_REGEX = /komoot\.(?:com|de)\/(?:[^/?#\s]+\/)?tour\/(\d+)/i;

export function extractTourId(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = TOUR_REGEX.exec(text);
  return m ? m[1] : null;
}

export function readShareHash(hash: string): string | null {
  const m = /^#share-tour=(\d+)$/.exec(hash);
  return m ? m[1] : null;
}

export function setPendingShare(tourId: string): void {
  localStorage.setItem(PENDING_KEY, tourId);
}

export function consumePendingShare(): string | null {
  const v = localStorage.getItem(PENDING_KEY);
  if (v) localStorage.removeItem(PENDING_KEY);
  return v;
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
