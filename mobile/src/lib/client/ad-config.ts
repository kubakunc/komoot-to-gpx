declare const __DEV__: boolean;

const TEST_BANNER = 'ca-app-pub-3940256099942544/6300978111';
const TEST_INTERSTITIAL = 'ca-app-pub-3940256099942544/1033173712';

// Replace with real values from AdMob console once they're issued (Task 7).
// While these stay equal to the test IDs, production builds will simply show
// test ads, which is a safer default than empty/null until prod is configured.
const PROD_BANNER = TEST_BANNER;
const PROD_RECT = TEST_BANNER;
const PROD_INTERSTITIAL = TEST_INTERSTITIAL;

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
