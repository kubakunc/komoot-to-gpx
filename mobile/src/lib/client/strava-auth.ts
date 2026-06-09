import { registerPlugin, Capacitor } from '@capacitor/core';

export interface NativeStravaLoginResult {
  userId: string;
  displayName: string;
  token: string;
}

interface StravaAuthPlugin {
  login(): Promise<NativeStravaLoginResult>;
}

const StravaAuth = registerPlugin<StravaAuthPlugin>('StravaAuth');

export class AuthCancelledError extends Error {
  readonly name = 'AuthCancelledError';
}

export class AuthUnsupportedError extends Error {
  readonly name = 'AuthUnsupportedError';
}

/**
 * Opens the native WebView at strava.com/login and resolves with the athlete's
 * identity after sign-in. The Strava session cookie stays in the native
 * CookieManager — it never crosses the JS bridge — and is replayed by the
 * StravaApi plugin on each request.
 */
export async function nativeStravaLogin(): Promise<NativeStravaLoginResult> {
  if (Capacitor.getPlatform() !== 'android') {
    throw new AuthUnsupportedError('Strava WebView login is only available in the Android app.');
  }
  try {
    const result = await StravaAuth.login();
    if (!result?.userId) {
      throw new AuthCancelledError('Login cancelled');
    }
    return result;
  } catch (e) {
    if ((e as Error).message?.toLowerCase().includes('cancel')) {
      throw new AuthCancelledError('Login cancelled');
    }
    throw e;
  }
}
