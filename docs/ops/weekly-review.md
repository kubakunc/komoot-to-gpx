# Weekly ad strategy review

Run every Monday morning (~10 minutes). Source of truth for triggers:
`docs/superpowers/specs/2026-05-11-ad-strategy-design.md` §6.2.

## Tabs to open

1. **Play Console → Vitals → Reach and devices → Users**
   - Note: DAU, MAU, day-1 / day-7 / day-30 retention
2. **Play Console → Ratings & reviews**
   - Filter: last 7 days, sort by lowest rating
   - Read every 1–2 ★. Search the page text for "ad", "ads", "advert".
3. **AdMob Console → Reports → All ad units**
   - Range: last 7 days
   - Note per unit: impressions, eCPM, revenue
4. **Play Console → Vitals → ANR & crash rate**
   - Threshold for bad week: ANR > 0.47%, crash rate > 1.09% (Play's "bad behaviour" thresholds)

## Decision matrix

| Observation | Action |
|---|---|
| Any 1–2 ★ review mentioning "ads" / "advert" | Reply within 24h, log it. If 2 in one week → consider softening (reduce frequency, smaller rect) |
| Day-7 retention dropped > 3 pp w/w | Pause any new ad slots, investigate; check release notes for recent changes |
| MAU crossed 1,000 for the first time | Phase 2 unlocked. Schedule the interstitial pilot rollout (flip `PHASE2.INTERSTITIAL_ENABLED` to `true` in `mobile/src/lib/client/ad-config.ts`) |
| MAU crossed 5,000 for the first time | Phase 3 unlocked. Plan Remove Ads IAP |
| Total revenue < $5 / month for 3 months running | Re-evaluate: either enable interstitial despite UX, or drop ads and ask for donations |
| Komoot DMCA / policy email | Pull app from Play immediately; everything else is moot |

## Where to log

Append a one-line entry to `docs/ops/weekly-review-log.md` (create on first run):

`2026-05-18 | DAU 42 | MAU 180 | rev $0.31 | 0 ad-related reviews | no action`
