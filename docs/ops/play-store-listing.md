# Play Store listing — copy

Paste these verbatim into **Play Console → Main store listing**.

## App name (≤ 30 chars)

```
Export GPX
```

(10 chars. This is the **canonical / default-language** app name — neutral, so
Strava users searching find it too. The **localized** listings set the title to
`Export GPX for Komoot, Strava` to surface both brands.)

## Short description (≤ 80 chars)

```
Export Komoot & Strava as GPX — for Garmin, Wahoo, any bike computer or watch.
```

(78 chars — fits. "Strava" stays out of the app title; it lives here and in the
full description for discoverability.)

## Full description (≤ 4000 chars)

```
Export GPX for Komoot lets you download your own Komoot tours as standard GPX files — including private ones — so you can load them onto your GPS watch, bike computer, or any navigation app that imports GPX.

You sign in to Komoot on their own login page (we never see your password). The app then lists every tour from your account, shows a real-map preview of each route, and saves any tour to your phone as a GPX file with one tap. You can also share a tour from the Komoot app straight into this one — it opens here, ready to export.

WHAT YOU CAN DO
• Browse every recorded ride and every planned route on your account.
• Filter the list to show only Completed or only Planned tours.
• See a real-map preview of each route before you export.
• Share a tour from the Komoot app — it opens here, ready to save (Share → Export GPX).
• Save a tour as a standard .gpx file anywhere on your phone — Downloads, Drive, Dropbox.
• Load the GPX file into Garmin Connect, Wahoo, Hammerhead, Bryton, Coros, Suunto, Apple Watch, OsmAnd, Locus Map, Gaia, or any other app that imports GPX.

ALSO WORKS WITH STRAVA
Sign in with Strava and export your activities and planned routes as GPX too — handy because the Strava app doesn't let you export GPX on the phone. When you're signed in to both, switch between Komoot and Strava with one tap.

YOUR ROUTES, ANY DEVICE
A route you planned or recorded is yours. Exporting it as a GPX file means you can navigate with any device you like — a Garmin or Wahoo bike computer, a sports watch, or another mapping app — while you keep planning in Komoot or Strava.

PRIVACY
The app has no backend server. Your Komoot login happens in an in-app browser on komoot.com — we never see your email or password. Tour data flows directly between your phone and Komoot's servers; we don't proxy or store it. Anonymous usage statistics and crash reports (Google Firebase) help us improve the app; in the EEA the app asks for consent first.

ADS
The app is free and shows a small banner ad. In the EEA the app asks for consent before serving personalized ads (you can decline and still use everything).

NOT AFFILIATED WITH KOMOOT OR STRAVA
This is a third-party tool. "Komoot" and "Strava" are trademarks of their respective owners (komoot GmbH and Strava, Inc.). We are not affiliated with, endorsed by, or sponsored by either. The app uses your own account to retrieve your own data.

SUPPORT
Found a bug? Tour not exporting? Email contact@velologic-labs.eu — usually a same-day reply.

Privacy policy: https://kubakunc.github.io/komoot-to-gpx/privacy-policy/
```

Approximate character count: ~2100 / 4000. Plenty of room if you want to add anything.

## What's new (≤ 500 chars) — first release

```
First release.
• Sign in with your own Komoot account (we never see your password).
• Browse every recorded and planned tour on your account.
• Preview each route on a real map.
• Filter by Completed or Planned.
• Export any tour as a standard .gpx file.
```

## Category

- **Primary:** Maps & Navigation
- **Secondary (Tags):** Sports, Travel & Local

## Contact details

- **Email:** contact@velologic-labs.eu (or whichever address you want public)
- **Phone:** leave blank (Play allows blank)
- **Website:** https://velologic-labs.eu

## Privacy Policy URL

```
https://kubakunc.github.io/komoot-to-gpx/privacy-policy/
```

Must be live BEFORE you submit for review.

## Graphics — files to upload

| Slot | File | Required size |
|---|---|---|
| App icon | `mobile/marketing/out/icon-hires-512.png` | 512×512 PNG |
| Feature graphic | `mobile/marketing/out/feature-graphic.png` | 1024×500 PNG |
| Phone screenshots (≥ 2, ≤ 8) | `mobile/marketing/screenshots/01-sign-in.png`, `02-strava-routes.png`, `03-switch-source.png`, `04-komoot-tours.png`, `05-export.png` | 1280×2450 PNG (real device captures) |

No tablet screenshots needed (Play allows phone-only).

## Content rating questionnaire — expected answers

| Question | Answer |
|---|---|
| Violence | No |
| Sexual content | No |
| Profanity | No |
| Controlled substances | No |
| Gambling | No |
| User-generated content | No |
| Social features | No |
| Personal info shared | No |
| Location sharing | No (only with Google for ads — declared in Data Safety) |

Resulting rating: **Everyone / PEGI 3 / USK 0**.

## Target audience

- **Age range:** 18+ (consistent with our Data Safety declaration that we don't target minors).
- **Appeals to children?** No.

## App access

- **All app functionality available without special access?** No — users need a Komoot account.
- Provide reviewer credentials: create a throwaway Komoot test account with one private + one planned tour, send login in the "Instructions" field.

---

## Naming decision

- **Canonical app name (default language + the on-device launcher label) =
  `Export GPX`** — neutral so it isn't pinned to one provider and Strava users
  can find it. Set in `mobile/android/.../res/values/strings.xml`.
- **Each localized listing title = `Export GPX for Komoot, Strava`** — both
  brands in the per-locale title for discoverability (the "for X" compatible-app
  pattern). Residual trademark risk is the user's accepted call (a competitor
  with 10k+ installs uses this same neutral-canonical + branded-localized
  pattern). Strava goes into the localized titles, short + full descriptions, and
  keywords.
- Do **not** use Strava's logo in the app icon or feature graphic (the icon's
  green/orange split is a generic colour split, not a logo).
