import { registerPlugin, Capacitor } from '@capacitor/core';

export interface NativeLoginResult {
  userId: string;
  token: string;
  email: string;
}

interface KomootAuthPlugin {
  login(): Promise<NativeLoginResult>;
}

const KomootAuth = registerPlugin<KomootAuthPlugin>('KomootAuth');

export class AuthCancelledError extends Error {
  readonly name = 'AuthCancelledError';
}

export class AuthUnsupportedError extends Error {
  readonly name = 'AuthUnsupportedError';
}

/**
 * Opens the native WebView at komoot.com/signin and resolves with the user's
 * Komoot identity (userId, long-lived token, email) after sign-in.
 *
 * The native side performs the /v006/account/ call against api.komoot.de so
 * the very large session-cookie header never crosses the JS bridge.
 */
export async function nativeLogin(): Promise<NativeLoginResult> {
  if (Capacitor.getPlatform() !== 'android') {
    throw new AuthUnsupportedError(
      'Komoot WebView login is only available in the Android app.'
    );
  }
  try {
    const result = await KomootAuth.login();
    if (!result?.userId || !result?.token) {
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
