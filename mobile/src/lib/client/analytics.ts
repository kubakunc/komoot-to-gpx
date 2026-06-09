import { Capacitor } from '@capacitor/core';
import type { ConsentType as ConsentTypeEnum } from '@capacitor-firebase/analytics';

const isAndroid = () => Capacitor.getPlatform() === 'android';

/** Every custom event the app emits. Nothing else may call Firebase directly. */
export const EVENTS = {
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAIL: 'login_fail',
  EXPORT_SUCCESS: 'export_success',
  EXPORT_FAIL: 'export_fail',
  SHARE_INTENT_RECEIVED: 'share_intent_received',
  FILTER_CHANGE: 'filter_change',
  REVIEW_PROMPT_SHOWN: 'review_prompt_shown'
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

/** Fire-and-forget event log; never throws, no-ops off Android. */
export async function track(name: EventName, params?: Record<string, string | number | boolean>): Promise<void> {
  if (!isAndroid()) return;
  try {
    const { FirebaseAnalytics } = await import('@capacitor-firebase/analytics');
    await FirebaseAnalytics.logEvent({ name, params });
  } catch (e) {
    console.warn('analytics track failed:', e);
  }
}

/** Non-fatal error reporting to Crashlytics; never throws, no-ops off Android. */
export async function recordError(e: unknown, context: string): Promise<void> {
  if (!isAndroid()) return;
  try {
    const { FirebaseCrashlytics } = await import('@capacitor-firebase/crashlytics');
    const message = `${context}: ${(e as Error)?.message ?? String(e)}`;
    await FirebaseCrashlytics.recordException({ message });
  } catch (err) {
    console.warn('crashlytics record failed:', err);
  }
}

/**
 * UMP tells us whether the consent flow resolved, not the user's granular
 * choices. Analytics storage is granted once the flow resolves; ad signals
 * are denied for Firebase unconditionally (AdMob does its own consent).
 */
export function decideAnalyticsConsent(umpStatus: string | undefined): boolean {
  return umpStatus === 'NOT_REQUIRED' || umpStatus === 'OBTAINED';
}

/** Push the consent split into the Firebase SDK. */
export async function applyAnalyticsConsent(granted: boolean): Promise<void> {
  if (!isAndroid()) return;
  try {
    const { FirebaseAnalytics, ConsentType, ConsentStatus } = await import('@capacitor-firebase/analytics');
    const set = (type: ConsentTypeEnum, ok: boolean) =>
      FirebaseAnalytics.setConsent({
        type,
        status: ok ? ConsentStatus.Granted : ConsentStatus.Denied
      });
    await set(ConsentType.AdStorage, false);
    await set(ConsentType.AdUserData, false);
    await set(ConsentType.AdPersonalization, false);
    await set(ConsentType.AnalyticsStorage, granted);
  } catch (e) {
    console.warn('analytics consent failed:', e);
  }
}
