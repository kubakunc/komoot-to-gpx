declare const __DEV__: boolean;

const TEST_BANNER = 'ca-app-pub-3940256099942544/6300978111';
const TEST_INTERSTITIAL = 'ca-app-pub-3940256099942544/1033173712';

// Production ad unit IDs from AdMob console
// (publisher: ca-app-pub-2450963113368391, app: Export GPX for Komoot).
const PROD_BANNER = 'ca-app-pub-2450963113368391/8266206709';        // tour-list-banner
const PROD_RECT = 'ca-app-pub-2450963113368391/6124248775';          // saved-modal-rect
const PROD_INTERSTITIAL = 'ca-app-pub-2450963113368391/3684348303';  // post-save-interstitial

export const AD_UNITS = {
  banner: __DEV__ ? TEST_BANNER : PROD_BANNER,
  rect: __DEV__ ? TEST_BANNER : PROD_RECT,
  interstitial: __DEV__ ? TEST_INTERSTITIAL : PROD_INTERSTITIAL
};

// Phase 2 feature flag. Flip to `true` only after MAU >= 1,000 and the spec's
// "Phase 2 unlocked" checklist passes (see ad-strategy spec section 6.2).
export const PHASE2 = {
  INTERSTITIAL_ENABLED: false,
  /** Trigger an interstitial on every N-th successful GPX save. */
  INTERSTITIAL_EVERY_NTH_SAVE: 5,
  /** Hard rate limit between interstitials within a single app session (ms). */
  INTERSTITIAL_MIN_GAP_MS: 60_000
};
