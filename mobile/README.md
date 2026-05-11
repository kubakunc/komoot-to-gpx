# Export GPX for Komoot — mobile (Android)

Native Android app distributed by **VeloLogic Labs** under bundle ID `com.velologiclabs.gpxexporter`.

## Requirements

- Node 22+, pnpm 10+
- **Android Studio** (or Android command-line tools + JDK 17)
- Set `ANDROID_HOME` to the SDK path before building APKs

## Develop the SPA (browser preview)

```bash
pnpm install
pnpm dev          # http://localhost:5174  — login button shows "Open in Android app"
pnpm test         # unit tests (gpx, komoot)
pnpm check        # svelte-check
```

## Build the Android APK

```bash
pnpm cap:sync             # rebuild SPA + sync to native shell
pnpm android:build        # debug APK at android/app/build/outputs/apk/debug/app-debug.apk
```

Alternatively open the project in Android Studio:

```bash
pnpm cap:open
```

Then click Run (Shift+F10).

See [`../docs/superpowers/specs/2026-05-11-play-store-launch-design.md`](../docs/superpowers/specs/2026-05-11-play-store-launch-design.md) and [`../docs/superpowers/plans/2026-05-11-mobile-app.md`](../docs/superpowers/plans/2026-05-11-mobile-app.md).
