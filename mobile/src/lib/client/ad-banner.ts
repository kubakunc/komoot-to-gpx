import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
  AdmobConsentStatus
} from '@capacitor-community/admob';
import { AD_UNITS, PHASE2 } from './ad-config';
import { applyAnalyticsConsent, decideAnalyticsConsent, recordError } from './analytics';

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
    let consentInfo = await AdMob.requestConsentInfo();
    if (consentInfo.isConsentFormAvailable && consentInfo.status === AdmobConsentStatus.REQUIRED) {
      await AdMob.showConsentForm();
      consentInfo = await AdMob.requestConsentInfo();
    }
    void applyAnalyticsConsent(decideAnalyticsConsent(consentInfo.status));
  } catch (e) {
    // If the consent flow itself failed (e.g. AdMob messaging misconfigured),
    // deny analytics consent rather than leaving it unset — safer in the EEA.
    void applyAnalyticsConsent(false);
    void recordError(e, 'admob-init');
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
      adId: AD_UNITS.banner,
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
      adId: AD_UNITS.rect,
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
 * Show an interstitial if PHASE2.INTERSTITIAL_ENABLED is true and more than
 * PHASE2.INTERSTITIAL_MIN_GAP_MS has passed since the last one. Caller decides
 * cadence (e.g. every Nth save). Returns true if shown.
 */
export async function maybeShowInterstitial(): Promise<boolean> {
  if (!isAndroid()) return false;
  if (!PHASE2.INTERSTITIAL_ENABLED) return false;
  const now = Date.now();
  if (now - lastInterstitialAt < PHASE2.INTERSTITIAL_MIN_GAP_MS) return false;
  try {
    await initAds();
    await AdMob.prepareInterstitial({ adId: AD_UNITS.interstitial });
    await AdMob.showInterstitial();
    lastInterstitialAt = now;
    return true;
  } catch (e) {
    console.warn('AdMob interstitial failed:', e);
    return false;
  }
}

declare const __DEV__: boolean;
