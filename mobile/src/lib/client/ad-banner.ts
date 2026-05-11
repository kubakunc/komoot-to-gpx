import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
  AdmobConsentStatus
} from '@capacitor-community/admob';

const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
// Replace with the real AdMob banner unit id before promoting from internal testing.
const PROD_BANNER_ID = TEST_BANNER_ID;

const isAndroid = () => Capacitor.getPlatform() === 'android';

let initialized = false;

export async function initAds(): Promise<void> {
  if (!isAndroid() || initialized) return;
  initialized = true;
  try {
    await AdMob.initialize({
      testingDevices: [],
      initializeForTesting: __DEV__
    });
    const consentInfo = await AdMob.requestConsentInfo();
    if (
      consentInfo.isConsentFormAvailable &&
      consentInfo.status === AdmobConsentStatus.REQUIRED
    ) {
      await AdMob.showConsentForm();
    }
  } catch (e) {
    // Banner just won't appear if init fails; we don't surface it to the UI.
    console.warn('AdMob init failed:', e);
  }
}

export async function showBanner(): Promise<void> {
  if (!isAndroid()) return;
  try {
    await initAds();
    await AdMob.showBanner({
      adId: __DEV__ ? TEST_BANNER_ID : PROD_BANNER_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0
    });
  } catch (e) {
    console.warn('AdMob banner show failed:', e);
  }
}

export async function hideBanner(): Promise<void> {
  if (!isAndroid()) return;
  try {
    await AdMob.hideBanner();
    await AdMob.removeBanner();
  } catch {
    /* banner may not be shown */
  }
}

declare const __DEV__: boolean;
