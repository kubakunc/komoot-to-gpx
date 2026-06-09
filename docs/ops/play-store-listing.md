# Play Store listing — copy

Paste these verbatim into **Play Console → Main store listing**.

## App name (≤ 30 chars)

```
Export GPX for Komoot
```

(20 chars — fits.)

## Short description (≤ 80 chars)

```
Export Komoot tours as GPX — for Garmin, Wahoo, any bike computer or GPS watch.
```

(79 chars — fits.)

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

YOUR ROUTES, ANY DEVICE
A route you planned or recorded is yours. Exporting it as a GPX file means you can navigate with any device you like — a Garmin or Wahoo bike computer, a sports watch, or another mapping app — while you keep planning in Komoot.

PRIVACY
The app has no backend server. Your Komoot login happens in an in-app browser on komoot.com — we never see your email or password. Tour data flows directly between your phone and Komoot's servers; we don't proxy or store it. Anonymous usage statistics and crash reports (Google Firebase) help us improve the app; in the EEA the app asks for consent first.

ADS
The app is free and shows a small banner ad. In the EEA the app asks for consent before serving personalized ads (you can decline and still use everything).

NOT AFFILIATED WITH KOMOOT
This is a third-party tool. "Komoot" is a registered trademark of komoot GmbH. We are not affiliated with or endorsed by komoot GmbH. The app uses your own account to retrieve your own data.

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
| Phone screenshots (≥ 2, ≤ 8) | `mobile/marketing/screenshots/01-login.png` through `04-saved.png` | 1200×2670 PNG |

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

## Strava addition (2026-06-09)

The app now also exports Strava activities. Per the trademark decision
(`docs/superpowers/specs/2026-06-09-strava-provider-design.md` §7), **"Strava"
stays out of the app title** and goes only into the description + keywords.

**Add this paragraph to the full description** (after the "WHAT YOU CAN DO" block):

```
ALSO WORKS WITH STRAVA
Sign in with Strava and export your activities as GPX too — handy because the
Strava mobile app doesn't let you export GPX on the phone. Switch between Komoot
and Strava with a tap when you're signed in to both.
```

**Append this disclaimer to the end of the full description:**

```
Not affiliated with, endorsed by, or sponsored by komoot GmbH or Strava, Inc.
"Komoot" and "Strava" are trademarks of their respective owners.
```

Apply the same two additions (translated) to each localized listing
(`play-store-listing-de/-nl/-fr/-it/-es/-pl.md`). Do **not** add "Strava" to the
localized app titles. Do not use Strava's logo or orange brand colour in the
icon or feature graphic.
