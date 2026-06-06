const REMINDER_AT_KEY = 'gpx-exporter:share-reminder-at';
/** Minimum time between share-feature reminder popups. */
const REMINDER_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Returns true when the share-from-Komoot reminder modal should pop up:
 * at most once every 14 days. The first launch only sets the baseline
 * (no popup — the permanent inline hint already explains the feature).
 */
export function shouldShowShareReminder(now: number = Date.now()): boolean {
  const last = Number(localStorage.getItem(REMINDER_AT_KEY) ?? '0');
  if (!last) {
    localStorage.setItem(REMINDER_AT_KEY, String(now));
    return false;
  }
  if (now - last >= REMINDER_INTERVAL_MS) {
    localStorage.setItem(REMINDER_AT_KEY, String(now));
    return true;
  }
  return false;
}
