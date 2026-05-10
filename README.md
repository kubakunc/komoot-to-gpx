# komoot-to-gpx

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
