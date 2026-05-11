import { registerPlugin, Capacitor } from '@capacitor/core';

interface KomootAuthPlugin {
  login(): Promise<{ cookies: string }>;
}

const KomootAuth = registerPlugin<KomootAuthPlugin>('KomootAuth');

export class AuthCancelledError extends Error {
  readonly name = 'AuthCancelledError';
}

export class AuthUnsupportedError extends Error {
  readonly name = 'AuthUnsupportedError';
}

/**
 * Opens the native WebView at komoot.com/signin and resolves with the captured
 * Komoot session cookie string after the user completes login.
 *
 * Throws AuthUnsupportedError if the platform is not Android (e.g. browser dev).
 */
export async function nativeLogin(): Promise<string> {
  if (Capacitor.getPlatform() !== 'android') {
    throw new AuthUnsupportedError(
      'Komoot WebView login is only available in the Android app.'
    );
  }
  try {
    const result = await KomootAuth.login();
    if (!result?.cookies) {
      throw new AuthCancelledError('Login cancelled');
    }
    return result.cookies;
  } catch (e) {
    if ((e as Error).message?.toLowerCase().includes('cancel')) {
      throw new AuthCancelledError('Login cancelled');
    }
    throw e;
  }
}
