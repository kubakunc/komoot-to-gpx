# komoot-to-gpx — web (PWA)

This is the original web/PWA version. The mobile (Android) app lives in `../mobile/`.
See `../docs/superpowers/specs/2026-05-11-play-store-launch-design.md` for context.

PWA pozwalająca pobierać prywatne i publiczne trasy z Komoota jako pliki GPX.

## Uruchomienie deweloperskie

```bash
pnpm install
pnpm dev
```

Otwórz http://localhost:5173.

## Testy

```bash
pnpm test           # unit (Vitest)
pnpm test:e2e       # e2e (Playwright; wymaga .env.test z KOMOOT_TEST_EMAIL i KOMOOT_TEST_PASSWORD)
```

## Deploy

```bash
docker compose up -d --build
```

Apka nasłuchuje na porcie 3000 lokalnie. Eksponuj przez Cloudflare Tunnel.
