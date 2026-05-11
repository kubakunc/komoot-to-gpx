# Play Data Safety form — answers cheat sheet

Use these exact answers when filling out **Play Console → Policy → App content
→ Data safety**. Source of truth: `docs/superpowers/specs/2026-05-11-ad-strategy-design.md`
sections 4.1 and 4.2.

## 1. Data collection and security

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** (via AdMob) |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS only) |
| Do you provide a way for users to request that their data is deleted? | **Yes** (uninstall + sign-out) |

## 2. Data types — declare these and only these

### Location
- **Approximate location**
  - Collected: **Yes**
  - Shared: **Yes** (with Google AdMob)
  - Processing: **Ephemeral** (Google's AdMob systems)
  - Purpose: **Advertising or marketing**
  - Optional/required: **Optional** (UMP consent declines result in non-personalized ads only)

### Device or other identifiers
- **Device or other IDs** (incl. Advertising ID)
  - Collected: **Yes**
  - Shared: **Yes** (with Google AdMob)
  - Purpose: **Advertising or marketing**
  - Optional/required: **Optional**

### Everything else — declare as NOT collected

- Personal info (name, email address, user IDs, address, phone number,
  race/ethnicity, political/religious info, sexual orientation, other): **None**
- Financial info: **None**
- Health & fitness: **None** (we never read your GPS or workouts; we relay
  Komoot's API responses to you locally and write a GPX file you explicitly
  choose to save)
- Messages, photos and videos, audio files, files and docs: **None**
- Calendar, contacts: **None**
- App activity (interactions, search history, installed apps, user-generated
  content, other actions): **None** (no analytics SDK; AdMob may log page views
  for ad attribution but that is covered under "Device or other IDs" above)
- Web browsing: **None**
- App info and performance (crash logs, diagnostics, other app performance
  data): **None** (no Crashlytics, no Firebase Performance)

## 3. Security practices

- **Data is encrypted in transit:** Yes
- **You can request that data is deleted:** Yes — uninstall the app and sign out
  of your Komoot account in the app, or contact `kunc@chaosgears.com`
- **Committed to Play Families Policy:** N/A (not targeted at families)

## 4. Privacy policy URL

`https://<owner>.github.io/komoot-to-gpx/privacy-policy/`

Replace `<owner>` with the GitHub repo owner once Pages is live — see
`docs/privacy-policy/README.md`.

## 5. Why this is defensible

The app has **no backend server**. There is no place we *could* be storing user
data even if we wanted to. The only network endpoints touched are:
`api.komoot.de` (the user's own account), `tile.openstreetmap.org` (public map
tiles), `www.komoot.com` (the user's own sign-in page), and Google AdMob's ad
serving infrastructure. The Komoot session token lives encrypted in Android
Keystore via Capacitor Preferences; we have no access to it.

If Play reviewers push back on any answer here, the trail to verify is:

- `mobile/src/lib/client/komoot.ts` — every API call goes through `KomootApi`
  native plugin that hits only `api.komoot.de`.
- `mobile/src/lib/client/ad-banner.ts` — only `@capacitor-community/admob`
  plugin is touched.
- `mobile/src/lib/client/session.ts` — Preferences only, never network.
- `mobile/android/app/src/main/AndroidManifest.xml` — only INTERNET and
  ACCESS_NETWORK_STATE permissions, no others.
