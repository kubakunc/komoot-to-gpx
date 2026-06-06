import { Capacitor } from '@capacitor/core';

/** Shared with the save flows in both tour pages. */
export const SAVE_COUNT_KEY = 'gpx-exporter:save-count';

/**
 * Ask for a Play Store rating on the 2nd successful save, then every 5
 * saves after that (7, 12, ...). Google throttles the actual dialog, so
 * repeated requests are free — most silently no-op.
 */
export function shouldRequestReview(saveCount: number): boolean {
  if (saveCount === 2) return true;
  return saveCount > 2 && (saveCount - 2) % 5 === 0;
}

/** Fire-and-forget: reads the save counter and asks Play for the dialog. */
export async function maybeRequestReview(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  const count = Number(localStorage.getItem(SAVE_COUNT_KEY) ?? '0');
  if (!shouldRequestReview(count)) return;
  try {
    const { InAppReview } = await import('@capacitor-community/in-app-review');
    await InAppReview.requestReview();
  } catch (e) {
    console.warn('In-app review failed:', e);
  }
}
