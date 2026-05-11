import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
  AdmobConsentStatus
} from '@capacitor-community/admob';

// Google's official test units — replace before promoting to production.
const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';
const TEST_RECT_ID = 'ca-app-pub-3940256099942544/6300978111';

const PROD_BANNER_ID = TEST_BANNER_ID;
const PROD_INTERSTITIAL_ID = TEST_INTERSTITIAL_ID;
const PROD_RECT_ID = TEST_RECT_ID;

const isAndroid = () => Capacitor.getPlatform() === 'android';

let initialized = false;
let stickyBannerShown = false;
let modalRectShown = false;
let lastInterstitialAt = 0;

export async function initAds(): Promise<void> {
  if (!isAndroid() || initialized) return;
  initialized = true;
  try {
    await AdMob.initialize({ testingDevices: [], initializeForTesting: __DEV__ });
    const consentInfo = await AdMob.requestConsentInfo();
    if (consentInfo.isConsentFormAvailable && consentInfo.status === AdmobConsentStatus.REQUIRED) {
      await AdMob.showConsentForm();
    }
  } catch (e) {
    console.warn('AdMob init failed:', e);
  }
}

/** Sticky adaptive banner anchored to the bottom of the tour list. */
export async function showBanner(): Promise<void> {
  if (!isAndroid()) return;
  try {
    await initAds();
    await hideAllBanners();
    await AdMob.showBanner({
      adId: __DEV__ ? TEST_BANNER_ID : PROD_BANNER_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0
    });
    stickyBannerShown = true;
  } catch (e) {
    console.warn('AdMob banner show failed:', e);
  }
}

export async function hideBanner(): Promise<void> {
  if (!isAndroid() || !stickyBannerShown) return;
  try {
    await AdMob.hideBanner();
    await AdMob.removeBanner();
  } catch { /* ignore */ }
  stickyBannerShown = false;
}

/** Medium-rectangle (300×250) banner shown center-screen for the Saved modal. */
export async function showModalRectangle(): Promise<void> {
  if (!isAndroid()) return;
  try {
    await initAds();
    await hideAllBanners();
    await AdMob.showBanner({
      adId: __DEV__ ? TEST_RECT_ID : PROD_RECT_ID,
      adSize: BannerAdSize.MEDIUM_RECTANGLE,
      position: BannerAdPosition.CENTER,
      margin: 0
    });
    modalRectShown = true;
  } catch (e) {
    console.warn('AdMob modal rect failed:', e);
  }
}

export async function hideModalRectangle(): Promise<void> {
  if (!isAndroid() || !modalRectShown) return;
  try {
    await AdMob.hideBanner();
    await AdMob.removeBanner();
  } catch { /* ignore */ }
  modalRectShown = false;
}

async function hideAllBanners(): Promise<void> {
  if (!isAndroid()) return;
  if (stickyBannerShown || modalRectShown) {
    try {
      await AdMob.hideBanner();
      await AdMob.removeBanner();
    } catch { /* ignore */ }
    stickyBannerShown = false;
    modalRectShown = false;
  }
}

/**
 * Show an interstitial if more than 60s have passed since the last one.
 * Caller decides cadence (e.g. every Nth save). Returns true if shown.
 */
export async function maybeShowInterstitial(): Promise<boolean> {
  if (!isAndroid()) return false;
  const now = Date.now();
  if (now - lastInterstitialAt < 60_000) return false;
  try {
    await initAds();
    await AdMob.prepareInterstitial({
      adId: __DEV__ ? TEST_INTERSTITIAL_ID : PROD_INTERSTITIAL_ID
    });
    await AdMob.showInterstitial();
    lastInterstitialAt = now;
    return true;
  } catch (e) {
    console.warn('AdMob interstitial failed:', e);
    return false;
  }
}

declare const __DEV__: boolean;
