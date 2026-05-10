# Komoot → GPX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA aplikacja na własnym serwerze, w której użytkownik loguje się kontem Komoot, przegląda listę swoich tras (publiczne i prywatne) i pobiera dowolną w formacie GPX.

**Architecture:** Jeden kontener Docker uruchamiający SvelteKit (Node adapter). Frontend (Svelte) + serwerowe endpointy (`/api/*`) w jednej apce. Endpointy działają jako proxy do nieoficjalnego API Komoota (`api.komoot.de`) i konwertują odpowiedzi do GPX. Stateless serwer; token Komoota trzymany w `localStorage` przeglądarki.

**Tech Stack:**
- SvelteKit 2.x + Svelte 5 (TypeScript)
- `@sveltejs/adapter-node`
- `@vite-pwa/sveltekit` (PWA / service worker)
- Vitest (unit), Playwright (E2E)
- Docker + docker-compose
- pnpm jako package manager

**Spec:** `docs/superpowers/specs/2026-05-10-komoot-to-gpx-design.md`

---

## File Structure

```
komoot-to-gpx/
├── .dockerignore
├── .env.example
├── .gitignore
├── .prettierrc
├── Dockerfile
├── README.md
├── docker-compose.yml
├── eslint.config.js
├── package.json
├── playwright.config.ts
├── pnpm-lock.yaml
├── svelte.config.js
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── docs/
│   └── superpowers/
│       ├── plans/2026-05-10-komoot-to-gpx.md   # this file
│       └── specs/2026-05-10-komoot-to-gpx-design.md
├── static/
│   ├── favicon.png
│   ├── icons/
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   └── manifest.webmanifest
├── src/
│   ├── app.css
│   ├── app.d.ts
│   ├── app.html
│   ├── lib/
│   │   ├── client/
│   │   │   └── session.ts
│   │   └── server/
│   │       ├── komoot.ts
│   │       ├── gpx.ts
│   │       └── rate-limit.ts
│   └── routes/
│       ├── +layout.svelte
│       ├── +layout.ts
│       ├── +page.svelte
│       ├── login/
│       │   └── +page.svelte
│       └── api/
│           ├── auth/
│           │   └── +server.ts
│           └── tours/
│               ├── +server.ts
│               └── [id]/
│                   └── gpx/
│                       └── +server.ts
└── tests/
    ├── unit/
    │   ├── gpx.test.ts
    │   ├── komoot.test.ts
    │   └── rate-limit.test.ts
    ├── fixtures/
    │   ├── tour.json
    │   ├── coordinates.json
    │   └── expected.gpx
    └── e2e/
        └── login-and-export.spec.ts
```

### File responsibilities

- **`src/lib/server/komoot.ts`** — async funkcje klienta API Komoota: `login`, `listTours`, `getTour`, `getCoordinates`. Nie zna SvelteKit. Każda funkcja przyjmuje `auth: { email, token }` lub `(email, password)` przy loginie. Filtruje hasło/token z błędów (czyste komunikaty).
- **`src/lib/server/gpx.ts`** — czysta funkcja `toGpx(metadata, coordinates) → string`. Generuje GPX 1.1 XML z metadanymi (`name`, `time`) i `<trkseg>` z `<trkpt>` (lat/lon, ele, time).
- **`src/lib/server/rate-limit.ts`** — prosty in-memory licznik prób per IP dla `/api/auth`. `check(ip) → { ok, retryAfterMs }`.
- **`src/lib/client/session.ts`** — `getSession()`, `setSession(s)`, `clearSession()` nad `localStorage`. Klucz: `komoot-to-gpx:session`.
- **`src/routes/api/auth/+server.ts`** — POST: rate-limit, woła `komoot.login`, zwraca `{ userId, token }`.
- **`src/routes/api/tours/+server.ts`** — GET: czyta `Authorization` z requestu, woła `komoot.listTours`, mapuje wynik.
- **`src/routes/api/tours/[id]/gpx/+server.ts`** — GET: woła `komoot.getTour` + `komoot.getCoordinates`, zwraca GPX z `Content-Disposition: attachment`.
- **`src/routes/+layout.svelte`** — wspólny layout (header, link wylogowania) + guard: jeśli brak sesji i ścieżka ≠ `/login`, redirect.
- **`src/routes/+page.svelte`** — lista tras z paginacją "wczytaj więcej" + przycisk "Pobierz GPX" przy każdej.
- **`src/routes/login/+page.svelte`** — formularz email + hasło, wysyła do `/api/auth`, po sukcesie zapisuje sesję i redirect `/`.

---

## Task 0: Inicjalizacja repo i .gitignore

**Files:**
- Create: `.gitignore`
- Create: `.dockerignore`
- Create: `.env.example`
- Create: `README.md`

- [ ] **Step 0.1: Sprawdź stan repo**

Run:
```bash
cd /Users/jakubkunc/code/komoot-to-gpx
git status
ls -la
```
Expected: repo zainicjalizowane (komity ze specem już są: `88a95f3`, `1dc3b82`).

- [ ] **Step 0.2: Utwórz `.gitignore`**

```gitignore
node_modules
.pnpm-store
.svelte-kit
build
.env
.env.local
.env.test
*.log
.DS_Store
playwright-report/
test-results/
coverage/
```

- [ ] **Step 0.3: Utwórz `.dockerignore`**

```
node_modules
.svelte-kit
.git
.gitignore
.env
.env.local
.env.test
build
docs
tests
playwright-report
test-results
coverage
README.md
```

- [ ] **Step 0.4: Utwórz `.env.example`**

```
# Komoot API base URL (override only for tests)
KOMOOT_BASE_URL=https://api.komoot.de

# Rate limit: prób na IP w oknie (prod: 5)
AUTH_RATE_LIMIT_MAX=5
# Rozmiar okna w sekundach
AUTH_RATE_LIMIT_WINDOW_S=60

# (E2E only) — wypełnij w .env.test, nie commituj
KOMOOT_TEST_EMAIL=
KOMOOT_TEST_PASSWORD=
```

- [ ] **Step 0.5: Utwórz `README.md`**

```markdown
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
```

- [ ] **Step 0.6: Commit**

```bash
git add .gitignore .dockerignore .env.example README.md
git commit -m "chore: add gitignore, dockerignore, env example, README"
```

---

## Task 1: Inicjalizacja SvelteKit + TypeScript

**Files:**
- Create: `package.json`
- Create: `svelte.config.js`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `src/app.html`
- Create: `src/app.d.ts`
- Create: `src/app.css`

- [ ] **Step 1.1: Utwórz `package.json`**

```json
{
  "name": "komoot-to-gpx",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "start": "node build",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "@sveltejs/adapter-node": "^5.2.0",
    "@sveltejs/kit": "^2.5.0",
    "@sveltejs/vite-plugin-svelte": "^4.0.0",
    "@types/node": "^22.0.0",
    "@vite-pwa/sveltekit": "^0.6.0",
    "@playwright/test": "^1.45.0",
    "eslint": "^9.0.0",
    "eslint-plugin-svelte": "^2.40.0",
    "prettier": "^3.3.0",
    "prettier-plugin-svelte": "^3.2.0",
    "svelte": "^5.0.0",
    "svelte-check": "^4.0.0",
    "typescript": "^5.5.0",
    "typescript-eslint": "^8.0.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 1.2: Utwórz `tsconfig.json`**

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "moduleResolution": "bundler"
  }
}
```

- [ ] **Step 1.3: Utwórz `svelte.config.js`**

```javascript
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ out: 'build' })
  }
};

export default config;
```

- [ ] **Step 1.4: Utwórz `vite.config.ts`** (PWA dodamy w Task 14, na razie minimalna konfiguracja)

```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 5173
  }
});
```

- [ ] **Step 1.5: Utwórz `src/app.html`**

```html
<!doctype html>
<html lang="pl">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%sveltekit.assets%/favicon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#1a73e8" />
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

- [ ] **Step 1.6: Utwórz `src/app.d.ts`**

```typescript
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface Platform {}
  }
}

export {};
```

- [ ] **Step 1.7: Utwórz minimalny `src/app.css`**

```css
:root {
  --color-bg: #fafafa;
  --color-fg: #222;
  --color-accent: #1a73e8;
  --color-border: #e0e0e0;
  --color-error: #c62828;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-fg);
}

button {
  cursor: pointer;
  font: inherit;
}
```

- [ ] **Step 1.8: Zainstaluj zależności**

Run:
```bash
pnpm install
```
Expected: `pnpm-lock.yaml` zostaje wygenerowany, brak błędów.

- [ ] **Step 1.9: Sanity build**

Run:
```bash
pnpm exec svelte-kit sync
pnpm check
```
Expected: brak błędów typescriptu (może być warning o pustych `App` namespace; to OK).

- [ ] **Step 1.10: Commit**

```bash
git add package.json pnpm-lock.yaml svelte.config.js vite.config.ts tsconfig.json src/app.html src/app.d.ts src/app.css
git commit -m "feat: scaffold SvelteKit + TypeScript project"
```

---

## Task 2: Konfiguracja Vitest + smoke test

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/unit/smoke.test.ts`

- [ ] **Step 2.1: Utwórz `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    globals: false
  }
});
```

- [ ] **Step 2.2: Utwórz `tests/unit/smoke.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2.3: Uruchom test**

Run:
```bash
pnpm test
```
Expected: `1 test passed`.

- [ ] **Step 2.4: Commit**

```bash
git add vitest.config.ts tests/unit/smoke.test.ts
git commit -m "test: add vitest config + smoke test"
```

---

## Task 3: GPX generator (TDD)

**Files:**
- Create: `tests/unit/gpx.test.ts`
- Create: `tests/fixtures/expected.gpx`
- Create: `src/lib/server/gpx.ts`

Generator zwraca GPX 1.1. Wejście: metadane (nazwa, sport, data ISO), lista współrzędnych. Każdy `coordinate`: `{ lat, lng, alt?, t? }`. Wyjście: string XML.

- [ ] **Step 3.1: Utwórz fixture `tests/fixtures/expected.gpx`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="komoot-to-gpx" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Test &amp; ride</name>
    <time>2026-05-01T08:00:00Z</time>
  </metadata>
  <trk>
    <name>Test &amp; ride</name>
    <type>racebike</type>
    <trkseg>
      <trkpt lat="52.5200000" lon="13.4050000"><ele>34.0</ele><time>2026-05-01T08:00:00Z</time></trkpt>
      <trkpt lat="52.5210000" lon="13.4060000"><ele>35.5</ele><time>2026-05-01T08:00:30Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>
```

- [ ] **Step 3.2: Napisz testy w `tests/unit/gpx.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toGpx } from '../../src/lib/server/gpx';

const fixture = (name: string) =>
  readFileSync(resolve(__dirname, '../fixtures', name), 'utf8');

describe('toGpx', () => {
  it('renders metadata, trk name, type and trkpts with ele/time matching the fixture', () => {
    const out = toGpx(
      {
        name: 'Test & ride',
        sport: 'racebike',
        startTimeIso: '2026-05-01T08:00:00Z'
      },
      [
        { lat: 52.52, lng: 13.405, alt: 34.0, t: '2026-05-01T08:00:00Z' },
        { lat: 52.521, lng: 13.406, alt: 35.5, t: '2026-05-01T08:00:30Z' }
      ]
    );

    expect(out.trim()).toBe(fixture('expected.gpx').trim());
  });

  it('escapes XML special characters in name', () => {
    const out = toGpx(
      { name: 'a < b > "c" & \'d\'', sport: 'hike', startTimeIso: '2026-01-01T00:00:00Z' },
      [{ lat: 0, lng: 0 }]
    );
    expect(out).toContain('a &lt; b &gt; &quot;c&quot; &amp; &apos;d&apos;');
    expect(out).not.toContain('a < b');
  });

  it('omits ele and time when absent on a coordinate', () => {
    const out = toGpx(
      { name: 'plain', sport: 'hike', startTimeIso: '2026-01-01T00:00:00Z' },
      [{ lat: 1, lng: 2 }]
    );
    expect(out).toContain('<trkpt lat="1.0000000" lon="2.0000000"></trkpt>');
    expect(out).not.toContain('<ele>');
    expect(out).not.toContain('<time>2026');  // time appears only in metadata, not in trkpt
  });

  it('handles empty coordinates list', () => {
    const out = toGpx(
      { name: 'empty', sport: 'hike', startTimeIso: '2026-01-01T00:00:00Z' },
      []
    );
    expect(out).toContain('<trkseg>');
    expect(out).toContain('</trkseg>');
    expect(out).not.toContain('<trkpt');
  });
});
```

- [ ] **Step 3.3: Uruchom testy — powinny się wywalić**

Run:
```bash
pnpm test gpx
```
Expected: FAIL — moduł `src/lib/server/gpx` nie istnieje.

- [ ] **Step 3.4: Implementacja `src/lib/server/gpx.ts`**

```typescript
export interface GpxMetadata {
  name: string;
  sport: string;
  startTimeIso: string;
}

export interface GpxCoordinate {
  lat: number;
  lng: number;
  alt?: number;
  t?: string;
}

const escape = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const fixed = (n: number, digits = 7) => n.toFixed(digits);

const renderPoint = (c: GpxCoordinate): string => {
  const inner: string[] = [];
  if (c.alt !== undefined) inner.push(`<ele>${c.alt.toFixed(1)}</ele>`);
  if (c.t !== undefined) inner.push(`<time>${escape(c.t)}</time>`);
  return `      <trkpt lat="${fixed(c.lat)}" lon="${fixed(c.lng)}">${inner.join('')}</trkpt>`;
};

export function toGpx(meta: GpxMetadata, coords: GpxCoordinate[]): string {
  const name = escape(meta.name);
  const points = coords.map(renderPoint).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="komoot-to-gpx" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <time>${escape(meta.startTimeIso)}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <type>${escape(meta.sport)}</type>
    <trkseg>${points ? '\n' + points + '\n    ' : ''}</trkseg>
  </trk>
</gpx>
`;
}
```

- [ ] **Step 3.5: Uruchom testy — powinny przejść**

Run:
```bash
pnpm test gpx
```
Expected: 4 testy PASS.

- [ ] **Step 3.6: Commit**

```bash
git add src/lib/server/gpx.ts tests/unit/gpx.test.ts tests/fixtures/expected.gpx
git commit -m "feat(gpx): GPX 1.1 generator with metadata + XML escaping"
```

---

## Task 4: Komoot client — login (TDD)

**Files:**
- Create: `src/lib/server/komoot.ts`
- Create: `tests/unit/komoot.test.ts`

Klient bazuje na nieoficjalnym API Komoota. Endpoint loginu: `GET /v006/account/email/{email}/` z `Authorization: Basic base64(email:password)`. Odpowiedź zawiera `username` (numeryczne ID jako string) i `password` (token).

- [ ] **Step 4.1: Napisz testy `tests/unit/komoot.test.ts`** (login only — kolejne metody w Task 5–7)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { login, KomootError } from '../../src/lib/server/komoot';

const ORIGINAL_FETCH = globalThis.fetch;

describe('komoot.login', () => {
  beforeEach(() => {
    vi.stubEnv('KOMOOT_BASE_URL', 'https://api.komoot.de');
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    vi.unstubAllEnvs();
  });

  it('sends GET to /v006/account/email/{email}/ with Basic auth and returns userId+token', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://api.komoot.de/v006/account/email/jakub%40example.com/');
      expect(init?.method).toBe('GET');
      const auth = (init?.headers as Record<string, string>).Authorization;
      expect(auth).toBe('Basic ' + Buffer.from('jakub@example.com:secret').toString('base64'));
      return new Response(
        JSON.stringify({ username: '12345', password: 'TOKEN_XYZ', email: 'jakub@example.com' }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await login('jakub@example.com', 'secret');

    expect(result).toEqual({ userId: '12345', token: 'TOKEN_XYZ' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('throws KomootError with status 401 on invalid credentials', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('Unauthorized', { status: 401 })
    ) as unknown as typeof fetch;

    await expect(login('a@b.c', 'wrong')).rejects.toMatchObject({
      name: 'KomootError',
      status: 401
    });
  });

  it('throws KomootError with status 502 when komoot returns 5xx', async () => {
    globalThis.fetch = vi.fn(async () => new Response('Bad Gateway', { status: 502 })) as unknown as typeof fetch;
    await expect(login('a@b.c', 'x')).rejects.toMatchObject({ name: 'KomootError', status: 502 });
  });

  it('does not include password in error message', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('Unauthorized', { status: 401 })
    ) as unknown as typeof fetch;

    try {
      await login('a@b.c', 'super-secret-password');
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as Error).message).not.toContain('super-secret-password');
    }
  });
});
```

- [ ] **Step 4.2: Uruchom — powinny się wywalić**

Run:
```bash
pnpm test komoot
```
Expected: FAIL — `src/lib/server/komoot` nie istnieje.

- [ ] **Step 4.3: Zaimplementuj `src/lib/server/komoot.ts`** (na razie tylko `login` + helpery; reszta w kolejnych taskach)

```typescript
const DEFAULT_BASE = 'https://api.komoot.de';
const USER_AGENT = 'komoot-to-gpx/0.1';

const baseUrl = () => process.env.KOMOOT_BASE_URL ?? DEFAULT_BASE;

export class KomootError extends Error {
  readonly name = 'KomootError';
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export interface KomootAuth {
  email: string;
  token: string;
}

interface AccountResponse {
  username: string;
  password: string;  // long-lived token despite the name
  email: string;
}

const basic = (email: string, secret: string) =>
  'Basic ' + Buffer.from(`${email}:${secret}`).toString('base64');

const headers = (auth: string) => ({
  Authorization: auth,
  'User-Agent': USER_AGENT,
  Accept: 'application/json'
});

async function call(path: string, auth: string): Promise<Response> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: 'GET',
    headers: headers(auth)
  });
  return res;
}

function failIfNotOk(res: Response, label: string): void {
  if (res.ok) return;
  // Map 5xx and unexpected statuses to 502 for our consumers; keep 401/404 as-is.
  const status = res.status >= 500 ? 502 : res.status;
  throw new KomootError(`${label} failed (komoot returned ${res.status})`, status);
}

export async function login(email: string, password: string): Promise<KomootAuth & { userId: string }> {
  const path = `/v006/account/email/${encodeURIComponent(email)}/`;
  const res = await call(path, basic(email, password));
  failIfNotOk(res, 'login');
  const body = (await res.json()) as AccountResponse;
  if (!body.username || !body.password) {
    throw new KomootError('login: unexpected response shape', 502);
  }
  return { userId: body.username, token: body.password, email };
}
```

> Uwaga: `KomootAuth` zawiera `email` + `token`; `login` zwraca dodatkowo `userId`. Frontend zapisze całość w localStorage.

- [ ] **Step 4.4: Uruchom testy**

Run:
```bash
pnpm test komoot
```
Expected: 4 testy PASS.

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/server/komoot.ts tests/unit/komoot.test.ts
git commit -m "feat(komoot): login() against /v006/account/email/{email}/"
```

---

## Task 5: Komoot client — listTours (TDD)

**Files:**
- Modify: `src/lib/server/komoot.ts`
- Modify: `tests/unit/komoot.test.ts`
- Create: `tests/fixtures/tours-page.json`

Komoot zwraca strony z embedded `_embedded.tours`. Mapujemy do cienkiego kształtu.

- [ ] **Step 5.1: Utwórz fixture `tests/fixtures/tours-page.json`** (skrócona próbka odpowiedzi `/v007/users/{id}/tours/`)

```json
{
  "_embedded": {
    "tours": [
      {
        "id": 111,
        "name": "Wieczorny ride",
        "type": "tour_recorded",
        "sport": "racebike",
        "distance": 42500.0,
        "date": "2026-04-30T17:30:00Z",
        "status": "private"
      },
      {
        "id": 222,
        "name": "Weekendowa pętla",
        "type": "tour_planned",
        "sport": "touringbicycle",
        "distance": 88000.0,
        "date": "2026-05-02T09:00:00Z",
        "status": "public"
      }
    ]
  },
  "page": { "size": 24, "totalElements": 2, "totalPages": 1, "number": 0 }
}
```

- [ ] **Step 5.2: Dodaj testy do `tests/unit/komoot.test.ts`**

```typescript
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { listTours } from '../../src/lib/server/komoot';

// (dopisz do istniejącego pliku, na końcu)

describe('komoot.listTours', () => {
  beforeEach(() => vi.stubEnv('KOMOOT_BASE_URL', 'https://api.komoot.de'));
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    vi.unstubAllEnvs();
  });

  it('GETs /v007/users/{id}/tours/ with Basic auth, page param and maps response', async () => {
    const fixturePath = resolve(__dirname, '../fixtures/tours-page.json');
    const body = readFileSync(fixturePath, 'utf8');

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(
        'https://api.komoot.de/v007/users/12345/tours/?type=tour_recorded%2Ctour_planned&page=0&limit=24'
      );
      expect((init?.headers as Record<string, string>).Authorization).toBe(
        'Basic ' + Buffer.from('a@b.c:TOKEN').toString('base64')
      );
      return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const page = await listTours(
      { email: 'a@b.c', token: 'TOKEN' },
      { userId: '12345', page: 0 }
    );

    expect(page.totalPages).toBe(1);
    expect(page.tours).toHaveLength(2);
    expect(page.tours[0]).toEqual({
      id: '111',
      name: 'Wieczorny ride',
      sport: 'racebike',
      distance: 42500,
      date: '2026-04-30T17:30:00Z',
      status: 'private',
      type: 'tour_recorded'
    });
  });

  it('propagates 401 as KomootError', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 401 })) as unknown as typeof fetch;
    await expect(
      listTours({ email: 'a@b.c', token: 'X' }, { userId: '1', page: 0 })
    ).rejects.toMatchObject({ name: 'KomootError', status: 401 });
  });
});
```

- [ ] **Step 5.3: Uruchom — powinno się wywalić na braku `listTours`**

Run:
```bash
pnpm test komoot
```
Expected: FAIL — `listTours` is not exported.

- [ ] **Step 5.4: Dodaj `listTours` do `src/lib/server/komoot.ts`**

```typescript
// dopisz do istniejącego pliku, eksportując nowy interfejs i funkcję

export interface TourSummary {
  id: string;
  name: string;
  sport: string;
  distance: number;          // meters
  date: string;              // ISO
  status: 'public' | 'private' | string;
  type: 'tour_recorded' | 'tour_planned' | string;
}

export interface ToursPage {
  tours: TourSummary[];
  page: number;
  totalPages: number;
}

interface ToursResponse {
  _embedded?: { tours?: Array<Record<string, unknown>> };
  page?: { number: number; totalPages: number };
}

export async function listTours(
  auth: KomootAuth,
  opts: { userId: string; page: number; limit?: number }
): Promise<ToursPage> {
  const limit = opts.limit ?? 24;
  const qs = new URLSearchParams({
    type: 'tour_recorded,tour_planned',
    page: String(opts.page),
    limit: String(limit)
  });
  const path = `/v007/users/${encodeURIComponent(opts.userId)}/tours/?${qs}`;
  const res = await call(path, basic(auth.email, auth.token));
  failIfNotOk(res, 'listTours');
  const body = (await res.json()) as ToursResponse;
  const tours = (body._embedded?.tours ?? []).map(toSummary);
  return {
    tours,
    page: body.page?.number ?? opts.page,
    totalPages: body.page?.totalPages ?? 1
  };
}

function toSummary(raw: Record<string, unknown>): TourSummary {
  return {
    id: String(raw.id),
    name: String(raw.name ?? 'untitled'),
    sport: String(raw.sport ?? 'unknown'),
    distance: Number(raw.distance ?? 0),
    date: String(raw.date ?? ''),
    status: String(raw.status ?? 'private'),
    type: String(raw.type ?? 'tour_recorded')
  };
}
```

- [ ] **Step 5.5: Uruchom testy**

Run:
```bash
pnpm test komoot
```
Expected: 6 testów PASS.

- [ ] **Step 5.6: Commit**

```bash
git add src/lib/server/komoot.ts tests/unit/komoot.test.ts tests/fixtures/tours-page.json
git commit -m "feat(komoot): listTours() with thin response mapping"
```

---

## Task 6: Komoot client — getTour + getCoordinates (TDD)

**Files:**
- Modify: `src/lib/server/komoot.ts`
- Modify: `tests/unit/komoot.test.ts`
- Create: `tests/fixtures/tour.json`
- Create: `tests/fixtures/coordinates.json`

Endpointy: `GET /v007/tours/{id}` (metadane) i `GET /v007/tours/{id}/coordinates` (punkty).

- [ ] **Step 6.1: Utwórz `tests/fixtures/tour.json`**

```json
{
  "id": 111,
  "name": "Wieczorny ride",
  "sport": "racebike",
  "date": "2026-04-30T17:30:00Z",
  "status": "private"
}
```

- [ ] **Step 6.2: Utwórz `tests/fixtures/coordinates.json`** (Komoot zwraca w formacie `items: [{lat, lng, alt, t}]`)

```json
{
  "items": [
    { "lat": 52.52, "lng": 13.405, "alt": 34.0, "t": 0 },
    { "lat": 52.521, "lng": 13.406, "alt": 35.5, "t": 30000 }
  ]
}
```

> Uwaga: `t` w Komoot to milisekundy od `tour.date`. Klient konwertuje na ISO timestamps.

- [ ] **Step 6.3: Dopisz testy do `tests/unit/komoot.test.ts`**

```typescript
import { getTour, getCoordinates } from '../../src/lib/server/komoot';

describe('komoot.getTour', () => {
  beforeEach(() => vi.stubEnv('KOMOOT_BASE_URL', 'https://api.komoot.de'));
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    vi.unstubAllEnvs();
  });

  it('GETs /v007/tours/{id} and returns mapped metadata', async () => {
    const body = readFileSync(resolve(__dirname, '../fixtures/tour.json'), 'utf8');
    globalThis.fetch = vi.fn(async (url: string) => {
      expect(url).toBe('https://api.komoot.de/v007/tours/111');
      return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;

    const meta = await getTour({ email: 'a@b.c', token: 'T' }, '111');
    expect(meta).toEqual({
      id: '111',
      name: 'Wieczorny ride',
      sport: 'racebike',
      date: '2026-04-30T17:30:00Z'
    });
  });
});

describe('komoot.getCoordinates', () => {
  beforeEach(() => vi.stubEnv('KOMOOT_BASE_URL', 'https://api.komoot.de'));
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    vi.unstubAllEnvs();
  });

  it('GETs /v007/tours/{id}/coordinates and converts t (ms-offset) to ISO using start time', async () => {
    const body = readFileSync(resolve(__dirname, '../fixtures/coordinates.json'), 'utf8');
    globalThis.fetch = vi.fn(async (url: string) => {
      expect(url).toBe('https://api.komoot.de/v007/tours/111/coordinates');
      return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;

    const coords = await getCoordinates(
      { email: 'a@b.c', token: 'T' },
      '111',
      '2026-04-30T17:30:00Z'
    );

    expect(coords).toHaveLength(2);
    expect(coords[0]).toEqual({ lat: 52.52, lng: 13.405, alt: 34.0, t: '2026-04-30T17:30:00.000Z' });
    expect(coords[1]).toEqual({ lat: 52.521, lng: 13.406, alt: 35.5, t: '2026-04-30T17:30:30.000Z' });
  });

  it('returns empty list when items missing', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } })
    ) as unknown as typeof fetch;

    const coords = await getCoordinates({ email: 'a@b.c', token: 'T' }, '111', '2026-01-01T00:00:00Z');
    expect(coords).toEqual([]);
  });
});
```

- [ ] **Step 6.4: Uruchom — fail**

Run:
```bash
pnpm test komoot
```
Expected: FAIL — `getTour` / `getCoordinates` nie istnieją.

- [ ] **Step 6.5: Dopisz funkcje do `src/lib/server/komoot.ts`**

```typescript
export interface TourMetadata {
  id: string;
  name: string;
  sport: string;
  date: string;  // ISO
}

export async function getTour(auth: KomootAuth, tourId: string): Promise<TourMetadata> {
  const path = `/v007/tours/${encodeURIComponent(tourId)}`;
  const res = await call(path, basic(auth.email, auth.token));
  failIfNotOk(res, 'getTour');
  const raw = (await res.json()) as Record<string, unknown>;
  return {
    id: String(raw.id),
    name: String(raw.name ?? 'untitled'),
    sport: String(raw.sport ?? 'unknown'),
    date: String(raw.date ?? '')
  };
}

export interface Coordinate {
  lat: number;
  lng: number;
  alt?: number;
  t?: string;  // ISO timestamp
}

export async function getCoordinates(
  auth: KomootAuth,
  tourId: string,
  startTimeIso: string
): Promise<Coordinate[]> {
  const path = `/v007/tours/${encodeURIComponent(tourId)}/coordinates`;
  const res = await call(path, basic(auth.email, auth.token));
  failIfNotOk(res, 'getCoordinates');
  const body = (await res.json()) as { items?: Array<Record<string, unknown>> };
  if (!body.items) return [];
  const start = Date.parse(startTimeIso);
  return body.items.map((p) => {
    const c: Coordinate = {
      lat: Number(p.lat),
      lng: Number(p.lng)
    };
    if (p.alt !== undefined) c.alt = Number(p.alt);
    if (p.t !== undefined && Number.isFinite(start)) {
      c.t = new Date(start + Number(p.t)).toISOString();
    }
    return c;
  });
}
```

- [ ] **Step 6.6: Uruchom testy**

Run:
```bash
pnpm test komoot
```
Expected: 9 testów PASS (4 login + 2 listTours + 1 getTour + 2 getCoordinates).

- [ ] **Step 6.7: Commit**

```bash
git add src/lib/server/komoot.ts tests/unit/komoot.test.ts tests/fixtures/tour.json tests/fixtures/coordinates.json
git commit -m "feat(komoot): getTour() and getCoordinates() with ms-to-ISO mapping"
```

---

## Task 7: Rate limiter (TDD)

**Files:**
- Create: `src/lib/server/rate-limit.ts`
- Create: `tests/unit/rate-limit.test.ts`

In-memory licznik prób per IP w oknie czasowym. Czyści wpisy starsze niż okno przy każdym `check`.

- [ ] **Step 7.1: Napisz testy `tests/unit/rate-limit.test.ts`**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRateLimiter } from '../../src/lib/server/rate-limit';

describe('rate-limiter', () => {
  beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));

  it('allows up to max attempts in the window', () => {
    const rl = createRateLimiter({ max: 3, windowMs: 60_000 });
    expect(rl.check('1.2.3.4').ok).toBe(true);
    expect(rl.check('1.2.3.4').ok).toBe(true);
    expect(rl.check('1.2.3.4').ok).toBe(true);
    expect(rl.check('1.2.3.4').ok).toBe(false);
  });

  it('returns retryAfterMs when blocked', () => {
    const rl = createRateLimiter({ max: 1, windowMs: 60_000 });
    rl.check('x');
    const r = rl.check('x');
    expect(r.ok).toBe(false);
    expect(r.retryAfterMs).toBeGreaterThan(0);
    expect(r.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it('resets after window passes', () => {
    const rl = createRateLimiter({ max: 1, windowMs: 60_000 });
    rl.check('y');
    expect(rl.check('y').ok).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(rl.check('y').ok).toBe(true);
  });

  it('tracks per-IP independently', () => {
    const rl = createRateLimiter({ max: 1, windowMs: 60_000 });
    rl.check('a');
    expect(rl.check('a').ok).toBe(false);
    expect(rl.check('b').ok).toBe(true);
  });
});
```

- [ ] **Step 7.2: Uruchom — fail**

Run:
```bash
pnpm test rate-limit
```
Expected: FAIL — moduł nie istnieje.

- [ ] **Step 7.3: Implementacja `src/lib/server/rate-limit.ts`**

```typescript
export interface RateLimitConfig {
  max: number;
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterMs: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
}

export function createRateLimiter(cfg: RateLimitConfig): RateLimiter {
  const hits = new Map<string, number[]>();

  return {
    check(key) {
      const now = Date.now();
      const cutoff = now - cfg.windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
      if (recent.length >= cfg.max) {
        const retryAfterMs = Math.max(0, recent[0] + cfg.windowMs - now);
        hits.set(key, recent);
        return { ok: false, retryAfterMs };
      }
      recent.push(now);
      hits.set(key, recent);
      return { ok: true, retryAfterMs: 0 };
    }
  };
}
```

- [ ] **Step 7.4: Uruchom testy**

Run:
```bash
pnpm test rate-limit
```
Expected: 4 testy PASS.

- [ ] **Step 7.5: Commit**

```bash
git add src/lib/server/rate-limit.ts tests/unit/rate-limit.test.ts
git commit -m "feat: in-memory per-key rate limiter"
```

---

## Task 8: Endpoint `/api/auth` (POST)

**Files:**
- Create: `src/routes/api/auth/+server.ts`

Walidacja body, rate-limit po IP (`getClientAddress()`), wywołanie `komoot.login`, zwrot `{ userId, token }`.

- [ ] **Step 8.1: Implementacja `src/routes/api/auth/+server.ts`**

```typescript
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { login, KomootError } from '$lib/server/komoot';
import { createRateLimiter } from '$lib/server/rate-limit';

const limiter = createRateLimiter({
  max: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 5),
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_S ?? 60) * 1000
});

interface AuthBody {
  email?: unknown;
  password?: unknown;
}

export const POST: RequestHandler = async ({ request, getClientAddress, setHeaders }) => {
  const ip = getClientAddress();
  const r = limiter.check(ip);
  if (!r.ok) {
    setHeaders({ 'Retry-After': String(Math.ceil(r.retryAfterMs / 1000)) });
    throw error(429, 'too many login attempts, try again later');
  }

  let body: AuthBody;
  try {
    body = (await request.json()) as AuthBody;
  } catch {
    throw error(400, 'invalid JSON body');
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    throw error(400, 'email and password required');
  }

  try {
    const result = await login(email, password);
    return json({ userId: result.userId, token: result.token });
  } catch (e) {
    if (e instanceof KomootError) {
      throw error(e.status, e.message);
    }
    throw error(502, 'unexpected error reaching komoot');
  }
};
```

- [ ] **Step 8.2: Sanity build**

Run:
```bash
pnpm exec svelte-kit sync
pnpm check
```
Expected: brak błędów typescriptu.

- [ ] **Step 8.3: Smoke test ręczny w devie**

Run w terminalu 1:
```bash
pnpm dev
```

W terminalu 2:
```bash
curl -i -X POST http://localhost:5173/api/auth \
  -H 'content-type: application/json' \
  -d '{"email":"missing","password":"x"}'
```
Expected: `HTTP/1.1 400` lub `502` (zależnie czy fetch trafił do prawdziwego komoota — nie ma znaczenia, ważne że endpoint odpowiada). Brak crashu serwera.

Stop dev server (`Ctrl+C` w terminalu 1).

- [ ] **Step 8.4: Commit**

```bash
git add src/routes/api/auth/+server.ts
git commit -m "feat(api): POST /api/auth with per-IP rate limit"
```

---

## Task 9: Endpoint `/api/tours` (GET)

**Files:**
- Create: `src/routes/api/tours/+server.ts`

GET czyta `Authorization: Basic ...` i `X-User-Id` z requestu, woła `komoot.listTours`, zwraca cienki kształt.

> Decyzja: zamiast wkładać userId do query stringu, frontend wysyła go w nagłówku `X-User-Id` (czyściej, jest częścią sesji). Inne podejście (URL `/api/tours/:userId`) wprowadziłoby zbędne ID użytkownika w ścieżce; mamy jeden user na sesję.

- [ ] **Step 9.1: Implementacja `src/routes/api/tours/+server.ts`**

```typescript
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { listTours, KomootError } from '$lib/server/komoot';

function parseBasicAuth(authHeader: string | null): { email: string; token: string } {
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    throw error(401, 'missing basic auth');
  }
  const decoded = Buffer.from(authHeader.slice('Basic '.length), 'base64').toString('utf8');
  const idx = decoded.indexOf(':');
  if (idx < 0) throw error(401, 'invalid basic auth');
  return { email: decoded.slice(0, idx), token: decoded.slice(idx + 1) };
}

export const GET: RequestHandler = async ({ request, url }) => {
  const auth = parseBasicAuth(request.headers.get('authorization'));
  const userId = request.headers.get('x-user-id') ?? '';
  if (!userId) throw error(400, 'X-User-Id header required');

  const page = Number(url.searchParams.get('page') ?? '0');
  if (!Number.isInteger(page) || page < 0) throw error(400, 'invalid page');

  try {
    const result = await listTours(auth, { userId, page });
    return json(result);
  } catch (e) {
    if (e instanceof KomootError) throw error(e.status, e.message);
    throw error(502, 'unexpected error reaching komoot');
  }
};
```

- [ ] **Step 9.2: Sanity check**

Run:
```bash
pnpm check
```
Expected: brak błędów.

- [ ] **Step 9.3: Commit**

```bash
git add src/routes/api/tours/+server.ts
git commit -m "feat(api): GET /api/tours with Basic auth + X-User-Id"
```

---

## Task 10: Endpoint `/api/tours/[id]/gpx` (GET)

**Files:**
- Create: `src/routes/api/tours/[id]/gpx/+server.ts`

GET wywołuje `getTour` + `getCoordinates`, generuje GPX, zwraca jako attachment.

- [ ] **Step 10.1: Implementacja `src/routes/api/tours/[id]/gpx/+server.ts`**

```typescript
import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { getTour, getCoordinates, KomootError } from '$lib/server/komoot';
import { toGpx } from '$lib/server/gpx';

function parseBasicAuth(h: string | null): { email: string; token: string } {
  if (!h || !h.startsWith('Basic ')) throw error(401, 'missing basic auth');
  const decoded = Buffer.from(h.slice(6), 'base64').toString('utf8');
  const idx = decoded.indexOf(':');
  if (idx < 0) throw error(401, 'invalid basic auth');
  return { email: decoded.slice(0, idx), token: decoded.slice(idx + 1) };
}

const safeFilename = (s: string) =>
  s.replace(/[^\p{L}\p{N}\-_ ]+/gu, '').trim().replace(/\s+/g, '_').slice(0, 80) || 'tour';

export const GET: RequestHandler = async ({ request, params }) => {
  const auth = parseBasicAuth(request.headers.get('authorization'));
  const tourId = params.id;
  if (!tourId) throw error(400, 'missing tour id');

  try {
    const meta = await getTour(auth, tourId);
    const coords = await getCoordinates(auth, tourId, meta.date);
    const gpx = toGpx(
      { name: meta.name, sport: meta.sport, startTimeIso: meta.date },
      coords
    );
    const filename = safeFilename(meta.name) + '.gpx';
    return new Response(gpx, {
      status: 200,
      headers: {
        'content-type': 'application/gpx+xml; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (e) {
    if (e instanceof KomootError) throw error(e.status, e.message);
    throw error(502, 'unexpected error reaching komoot');
  }
};
```

- [ ] **Step 10.2: Sanity check**

Run:
```bash
pnpm check
```
Expected: brak błędów.

- [ ] **Step 10.3: Commit**

```bash
git add src/routes/api/tours/[id]/gpx/+server.ts
git commit -m "feat(api): GET /api/tours/[id]/gpx with attachment download"
```

---

## Task 11: Sesja klienta (`lib/client/session.ts`)

**Files:**
- Create: `src/lib/client/session.ts`

Wąski moduł nad `localStorage`. Zwraca `null`, gdy serwer (SSR) — wtedy `localStorage` nie istnieje.

- [ ] **Step 11.1: Implementacja**

```typescript
const KEY = 'komoot-to-gpx:session';

export interface Session {
  email: string;
  userId: string;
  token: string;
}

export function getSession(): Session | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (parsed.email && parsed.userId && parsed.token) return parsed;
  } catch {
    /* ignore malformed */
  }
  return null;
}

export function setSession(s: Session): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession(): void {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY);
}

export function authHeader(s: Session): string {
  return 'Basic ' + btoa(`${s.email}:${s.token}`);
}
```

- [ ] **Step 11.2: Commit**

```bash
git add src/lib/client/session.ts
git commit -m "feat(client): localStorage session helpers"
```

---

## Task 12: Layout + route guard

**Files:**
- Create: `src/routes/+layout.svelte`
- Create: `src/routes/+layout.ts`

`+layout.ts` wyłącza SSR (apka jest klientem przed wszystkim, sesja w localStorage). Layout robi guard.

- [ ] **Step 12.1: Utwórz `src/routes/+layout.ts`**

```typescript
export const ssr = false;
export const prerender = false;
```

- [ ] **Step 12.2: Utwórz `src/routes/+layout.svelte`**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { getSession, clearSession } from '$lib/client/session';
  import '../app.css';

  let ready = $state(false);
  let email = $state<string | null>(null);

  onMount(() => {
    const s = getSession();
    const path = $page.url.pathname;
    if (!s && path !== '/login') {
      goto('/login', { replaceState: true });
      return;
    }
    if (s && path === '/login') {
      goto('/', { replaceState: true });
      return;
    }
    email = s?.email ?? null;
    ready = true;
  });

  function logout() {
    clearSession();
    email = null;
    goto('/login', { replaceState: true });
  }
</script>

<header class="app-header">
  <span class="brand">komoot → GPX</span>
  {#if email}
    <span class="user">{email}</span>
    <button onclick={logout}>wyloguj</button>
  {/if}
</header>

{#if ready}
  <main>
    <slot />
  </main>
{/if}

<style>
  .app-header {
    display: flex;
    gap: 1rem;
    align-items: center;
    padding: 0.75rem 1rem;
    background: white;
    border-bottom: 1px solid var(--color-border);
  }
  .brand { font-weight: 600; }
  .user { margin-left: auto; color: #666; font-size: 0.9rem; }
  main { max-width: 800px; margin: 0 auto; padding: 1rem; }
</style>
```

- [ ] **Step 12.3: Sanity check**

Run:
```bash
pnpm check
```
Expected: brak błędów (ostrzeżenia o `slot` w Svelte 5 są OK; alternatywa to `{@render children()}` z Svelte 5 runes — tu zostawiamy `<slot />` bo to mała apka i interop działa).

- [ ] **Step 12.4: Commit**

```bash
git add src/routes/+layout.svelte src/routes/+layout.ts
git commit -m "feat(ui): app layout with auth guard + logout"
```

---

## Task 13: Strony `/login` i `/`

**Files:**
- Create: `src/routes/login/+page.svelte`
- Create: `src/routes/+page.svelte`

- [ ] **Step 13.1: Utwórz `src/routes/login/+page.svelte`**

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { setSession } from '$lib/client/session';

  let email = $state('');
  let password = $state('');
  let error = $state<string | null>(null);
  let busy = $state(false);

  async function submit(e: Event) {
    e.preventDefault();
    error = null;
    busy = true;
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.status === 401) {
        error = 'Nieprawidłowy email lub hasło.';
        return;
      }
      if (res.status === 429) {
        error = 'Zbyt wiele prób. Spróbuj za chwilę.';
        return;
      }
      if (!res.ok) {
        error = 'Komoot nie odpowiada. Spróbuj ponownie.';
        return;
      }
      const data = (await res.json()) as { userId: string; token: string };
      setSession({ email, userId: data.userId, token: data.token });
      await goto('/', { replaceState: true });
    } catch {
      error = 'Brak połączenia.';
    } finally {
      busy = false;
    }
  }
</script>

<h1>Zaloguj się do Komoota</h1>

<form onsubmit={submit}>
  <label>
    email
    <input type="email" bind:value={email} required autocomplete="username" />
  </label>
  <label>
    hasło
    <input type="password" bind:value={password} required autocomplete="current-password" />
  </label>
  {#if error}<p class="error">{error}</p>{/if}
  <button type="submit" disabled={busy}>{busy ? 'logowanie…' : 'zaloguj'}</button>
</form>

<p class="note">Hasło używamy tylko raz — do pobrania tokenu Komoota. Jest trzymane wyłącznie w pamięci podczas żądania.</p>

<style>
  form { display: grid; gap: 0.75rem; max-width: 360px; }
  label { display: grid; gap: 0.25rem; }
  input { padding: 0.5rem; border: 1px solid var(--color-border); border-radius: 4px; font: inherit; }
  button { padding: 0.6rem 1rem; background: var(--color-accent); color: white; border: 0; border-radius: 4px; }
  button:disabled { opacity: 0.5; }
  .error { color: var(--color-error); margin: 0; }
  .note { color: #666; font-size: 0.85rem; margin-top: 1.5rem; }
</style>
```

- [ ] **Step 13.2: Utwórz `src/routes/+page.svelte`** (lista tras)

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authHeader, clearSession, getSession } from '$lib/client/session';

  interface TourSummary {
    id: string;
    name: string;
    sport: string;
    distance: number;
    date: string;
    status: string;
    type: string;
  }

  let tours = $state<TourSummary[]>([]);
  let page = $state(0);
  let totalPages = $state(1);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let downloading = $state<string | null>(null);

  async function loadPage(p: number) {
    const s = getSession();
    if (!s) return;
    loading = true;
    error = null;
    try {
      const res = await fetch(`/api/tours?page=${p}`, {
        headers: { authorization: authHeader(s), 'x-user-id': s.userId }
      });
      if (res.status === 401) {
        clearSession();
        await goto('/login', { replaceState: true });
        return;
      }
      if (!res.ok) {
        error = 'Nie udało się załadować tras.';
        return;
      }
      const data = (await res.json()) as { tours: TourSummary[]; totalPages: number; page: number };
      tours = p === 0 ? data.tours : [...tours, ...data.tours];
      totalPages = data.totalPages;
      page = data.page;
    } finally {
      loading = false;
    }
  }

  async function download(t: TourSummary) {
    const s = getSession();
    if (!s) return;
    downloading = t.id;
    error = null;
    try {
      const res = await fetch(`/api/tours/${t.id}/gpx`, {
        headers: { authorization: authHeader(s) }
      });
      if (res.status === 401) {
        clearSession();
        await goto('/login', { replaceState: true });
        return;
      }
      if (!res.ok) {
        error = 'Pobieranie nie powiodło się.';
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${t.name.replace(/[^\p{L}\p{N}\-_ ]+/gu, '').trim().replace(/\s+/g, '_') || 'tour'}.gpx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      downloading = null;
    }
  }

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pl-PL', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function fmtDist(m: number): string {
    return (m / 1000).toFixed(1) + ' km';
  }

  onMount(() => loadPage(0));
</script>

<h1>Twoje trasy</h1>

{#if error}<p class="error">{error}</p>{/if}

{#if tours.length === 0 && !loading}
  <p>Brak tras.</p>
{/if}

<ul class="tours">
  {#each tours as t (t.id)}
    <li>
      <div class="meta">
        <strong>{t.name}</strong>
        <span class="sub">{fmtDate(t.date)} · {fmtDist(t.distance)} · {t.sport} · {t.status}</span>
      </div>
      <button onclick={() => download(t)} disabled={downloading === t.id}>
        {downloading === t.id ? 'pobieram…' : 'GPX'}
      </button>
    </li>
  {/each}
</ul>

{#if page + 1 < totalPages}
  <button class="more" onclick={() => loadPage(page + 1)} disabled={loading}>
    {loading ? 'ładuję…' : 'wczytaj więcej'}
  </button>
{/if}

<style>
  .tours { list-style: none; padding: 0; display: grid; gap: 0.5rem; }
  .tours li {
    display: flex; align-items: center; gap: 1rem;
    padding: 0.75rem 1rem;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 6px;
  }
  .meta { flex: 1; min-width: 0; }
  .sub { display: block; color: #666; font-size: 0.85rem; }
  .more { margin-top: 1rem; padding: 0.6rem 1rem; }
  button { padding: 0.4rem 0.8rem; background: var(--color-accent); color: white; border: 0; border-radius: 4px; }
  button:disabled { opacity: 0.5; }
  .error { color: var(--color-error); }
</style>
```

- [ ] **Step 13.3: Sanity check**

Run:
```bash
pnpm check
```
Expected: brak błędów typescriptu.

- [ ] **Step 13.4: Smoke test ręczny w przeglądarce**

Run:
```bash
pnpm dev
```
Otwórz http://localhost:5173 → powinno przekierować na `/login`. Wypełnij prawdziwym kontem Komoot. Po zalogowaniu zobacz listę tras. Kliknij "GPX" przy jednej trasie → plik powinien się pobrać.

(Jeśli nie masz konta testowego pod ręką, pomiń smoke test — testy E2E są w Task 16.)

- [ ] **Step 13.5: Commit**

```bash
git add src/routes/login/+page.svelte src/routes/+page.svelte
git commit -m "feat(ui): login page + tours list with GPX download"
```

---

## Task 14: PWA (manifest + service worker)

**Files:**
- Modify: `vite.config.ts`
- Create: `static/manifest.webmanifest`
- Create: `static/icons/icon-192.png`
- Create: `static/icons/icon-512.png`
- Create: `static/favicon.png`

- [ ] **Step 14.1: Wygeneruj placeholder ikony**

Użyj prostego narzędzia (np. ImageMagick) do wygenerowania jednolitych kolorowych kwadratów. Jeśli ImageMagick brak — skopiuj dowolny PNG 192x192 i 512x512 (do podmiany później).

Run (jeśli masz ImageMagick):
```bash
mkdir -p static/icons
convert -size 192x192 xc:'#1a73e8' -gravity center -fill white -pointsize 110 -annotate +0+0 'K→' static/icons/icon-192.png
convert -size 512x512 xc:'#1a73e8' -gravity center -fill white -pointsize 280 -annotate +0+0 'K→' static/icons/icon-512.png
cp static/icons/icon-192.png static/favicon.png
```

Jeśli nie masz `convert` — utwórz jednokolorowe placeholdery:
```bash
python3 -c "
from struct import pack
def png(w, h, r, g, b):
    import zlib
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)
    def chunk(t, d):
        import binascii
        c = binascii.crc32(t + d)
        return pack('>I', len(d)) + t + d + pack('>I', c & 0xffffffff)
    raw = b''
    for _ in range(h):
        raw += b'\x00' + bytes([r,g,b]) * w
    idat = zlib.compress(raw)
    return sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')
open('static/icons/icon-192.png','wb').write(png(192,192,26,115,232))
open('static/icons/icon-512.png','wb').write(png(512,512,26,115,232))
open('static/favicon.png','wb').write(png(32,32,26,115,232))
"
```

- [ ] **Step 14.2: Utwórz `static/manifest.webmanifest`**

```json
{
  "name": "komoot → GPX",
  "short_name": "komoot→GPX",
  "description": "Pobieraj prywatne trasy Komoota jako GPX.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#fafafa",
  "theme_color": "#1a73e8",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 14.3: Dodaj plugin PWA do `vite.config.ts`**

```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      manifest: false,           // używamy własnego static/manifest.webmanifest
      workbox: {
        globPatterns: ['client/**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallback: null   // nie obsługujemy offline dla SPA na razie
      }
    })
  ],
  server: { port: 5173 }
});
```

- [ ] **Step 14.4: Dodaj link do manifestu w `src/app.html`**

```html
<!-- w <head>, po <meta theme-color> -->
<link rel="manifest" href="%sveltekit.assets%/manifest.webmanifest" />
<link rel="apple-touch-icon" href="%sveltekit.assets%/icons/icon-192.png" />
```

(Edytuj `src/app.html` ręcznie, dorzucając te dwie linijki w sekcji `<head>` po `<meta name="theme-color">`.)

- [ ] **Step 14.5: Build production i sprawdź, że manifest jest serwowany**

Run:
```bash
pnpm build
node build &
SERVER_PID=$!
sleep 2
curl -sI http://localhost:3000/manifest.webmanifest | head -1
kill $SERVER_PID
```
Expected: `HTTP/1.1 200 OK`.

- [ ] **Step 14.6: Commit**

```bash
git add vite.config.ts static/manifest.webmanifest static/icons static/favicon.png src/app.html
git commit -m "feat(pwa): manifest, icons, vite-pwa service worker"
```

---

## Task 15: Dockerfile + docker-compose

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`

- [ ] **Step 15.1: Utwórz `Dockerfile`** (multistage)

```dockerfile
# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod

# ---- runtime stage ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
EXPOSE 3000
USER node
CMD ["node", "build"]
```

- [ ] **Step 15.2: Utwórz `docker-compose.yml`**

```yaml
services:
  app:
    build: .
    image: komoot-to-gpx:latest
    container_name: komoot-to-gpx
    restart: unless-stopped
    environment:
      NODE_ENV: production
      KOMOOT_BASE_URL: ${KOMOOT_BASE_URL:-https://api.komoot.de}
      AUTH_RATE_LIMIT_MAX: ${AUTH_RATE_LIMIT_MAX:-5}
      AUTH_RATE_LIMIT_WINDOW_S: ${AUTH_RATE_LIMIT_WINDOW_S:-60}
    ports:
      - "127.0.0.1:3000:3000"

  # Opcjonalnie: cloudflared. Jeśli masz już cloudflared zainstalowany na serwerze,
  # usuń tę sekcję i skonfiguruj tunel przez systemową instalację.
  # cloudflared:
  #   image: cloudflare/cloudflared:latest
  #   container_name: komoot-to-gpx-tunnel
  #   restart: unless-stopped
  #   command: tunnel --no-autoupdate run --token ${CLOUDFLARED_TOKEN}
  #   environment:
  #     CLOUDFLARED_TOKEN: ${CLOUDFLARED_TOKEN}
  #   depends_on:
  #     - app
```

- [ ] **Step 15.3: Sprawdź build**

Run:
```bash
docker compose build
```
Expected: build kończy się sukcesem (image `komoot-to-gpx:latest` zbudowany).

- [ ] **Step 15.4: Sprawdź uruchomienie**

Run:
```bash
docker compose up -d
sleep 3
curl -sI http://127.0.0.1:3000/ | head -1
docker compose logs --tail 20 app
docker compose down
```
Expected: `HTTP/1.1 200 OK` (lub redirect 30x), brak crashów w logach.

- [ ] **Step 15.5: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat(deploy): multi-stage Dockerfile + docker-compose"
```

---

## Task 16: Testy E2E (Playwright, opcjonalne — wymagają konta Komoot)

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/login-and-export.spec.ts`

- [ ] **Step 16.1: Zainstaluj playwright**

Run:
```bash
pnpm exec playwright install chromium
```

- [ ] **Step 16.2: Utwórz `playwright.config.ts`**

```typescript
import { defineConfig } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
```

> Zainstaluj `dotenv` jako devDep:
> ```bash
> pnpm add -D dotenv
> ```

- [ ] **Step 16.3: Utwórz `tests/e2e/login-and-export.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';

const email = process.env.KOMOOT_TEST_EMAIL;
const password = process.env.KOMOOT_TEST_PASSWORD;

test.skip(!email || !password, 'Set KOMOOT_TEST_EMAIL and KOMOOT_TEST_PASSWORD in .env.test');

test('login and download a GPX', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);

  await page.fill('input[type="email"]', email!);
  await page.fill('input[type="password"]', password!);
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/');
  const firstTour = page.locator('.tours li').first();
  await expect(firstTour).toBeVisible({ timeout: 15_000 });

  const downloadPromise = page.waitForEvent('download');
  await firstTour.locator('button').click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  expect(existsSync(path!)).toBe(true);
  expect(download.suggestedFilename()).toMatch(/\.gpx$/);
});
```

- [ ] **Step 16.4: Uruchom (opcjonalnie, jeśli masz `.env.test`)**

```bash
# create .env.test with KOMOOT_TEST_EMAIL/KOMOOT_TEST_PASSWORD
pnpm test:e2e
```
Expected: 1 test PASS, lub `skipped` jeśli brak env.

- [ ] **Step 16.5: Commit**

```bash
git add playwright.config.ts tests/e2e/login-and-export.spec.ts package.json pnpm-lock.yaml
git commit -m "test(e2e): playwright login → download GPX flow"
```

---

## Task 17: Final review + manifest sanity

**Files:**
- (no edits, only checks)

- [ ] **Step 17.1: Pełny lint + check**

Run:
```bash
pnpm check
pnpm test
```
Expected: wszystkie testy PASS, brak błędów w `pnpm check`.

- [ ] **Step 17.2: Build production weryfikacja**

```bash
pnpm build
```
Expected: build kończy się bez błędów. Folder `build/` istnieje.

- [ ] **Step 17.3: Sprawdź końcowy stan repo**

```bash
git status
git log --oneline
```
Expected: clean working tree, ~17 commitów odpowiadających taskom.

- [ ] **Step 17.4: Final commit (jeśli coś zostało)**

```bash
git add -A
git diff --cached --quiet || git commit -m "chore: final cleanup"
```

---

## Self-review (zakończony przez autora planu)

**Spec coverage:**
- §3 Decyzje produktowe: pokryte przez Task 1, 12, 13 (UI), 14 (PWA), 15 (Docker).
- §4 Architektura: Task 8/9/10 (proxy endpoints), Task 15 (Docker), Cloudflare Tunnel — opisany w README, opcjonalna usługa w compose.
- §5.1 Login flow: Task 4 (klient) + Task 8 (endpoint) + Task 13 (UI logowania).
- §5.2 Lista tras: Task 5 (klient) + Task 9 (endpoint) + Task 13 (UI listy).
- §5.3 Eksport GPX: Task 3 (generator) + Task 6 (klient) + Task 10 (endpoint) + Task 13 (klik download).
- §5.4 Wygaśnięcie tokenu: obsługa 401 w Task 13 (`+page.svelte`, login `+page.svelte`).
- §6 Struktura kodu: zachowana 1:1 w File Structure.
- §7 Bezpieczeństwo: rate-limit Task 7, hasło tylko in-memory (Task 4 + 8), brak zewnętrznych skryptów (Task 1).
- §8 Obsługa błędów: 401/429/502 mapowanie w Task 8/9/10 + UI w Task 13.
- §9 Testowanie: unit Task 3/4/5/6/7, E2E Task 16, snapshot przez `expected.gpx` fixture w Task 3.
- §10 Deploy: Task 15.
- §11 Out of scope: nic z poza-zakresu nie zostało dodane.

**Placeholder scan:** brak "TBD"/"TODO"/"podobne do" — wszystkie taski mają konkretny kod.

**Type consistency:**
- `KomootAuth = { email, token }` — używane spójnie w Task 4–10.
- `TourSummary` w Task 5 — odpowiada kształtowi konsumowanemu w Task 13 (`+page.svelte` definiuje lokalny interface o tym samym kształcie; OK dla SPA).
- `toGpx({ name, sport, startTimeIso }, coords)` w Task 3 — wywoływane identycznie w Task 10.
- `RateLimiter.check()` zwraca `{ ok, retryAfterMs }` — spójnie używane w Task 8.

Plan kompletny.
