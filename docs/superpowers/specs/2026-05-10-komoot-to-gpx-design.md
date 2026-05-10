# Komoot → GPX — design (MVP)

**Data:** 2026-05-10
**Status:** zatwierdzony
**Autor brainstormingu:** Jakub Kunc + Claude

## 1. Cel

Web/PWA aplikacja, w której użytkownik loguje się swoim kontem Komoot, przegląda swoje trasy (publiczne, prywatne, planowane oraz nagrane) i pobiera dowolną z nich w formacie GPX. Tę samą aplikację można dodać do ekranu głównego iPhone'a / Androida i używać jak natywnej apki (PWA).

## 2. Kontekst i ograniczenia

- **Komoot nie ma publicznego API** (stan: maj 2026). Eksport prywatnych tras działa wyłącznie przez **nieoficjalne, wewnętrzne API** używane przez aplikację Komoot.
- Brak OAuth — autoryzacja odbywa się przez email + hasło użytkownika.
- API może się zmienić bez ostrzeżenia → akceptujemy ryzyko przestoju.
- **Audience:** rodzina i znajomi (kilku użytkowników). Aplikacja nie jest publicznym SaaS-em.
- Hosting: serwer użytkownika, ekspozycja przez Cloudflare Tunnel.

## 3. Decyzje produktowe

| Decyzja | Wybór | Dlaczego |
|---|---|---|
| Audience | Wąska grupa (rodzina/znajomi) | Brak rejestracji, brak DB użytkowników |
| Forma | PWA (jeden URL działający w przeglądarce + jako apka po dodaniu do ekranu głównego) | Jedna baza kodu, brak App Store |
| Zakres MVP | Login → lista tras → wybór jednej → pobierz GPX | YAGNI — bulk i filtry można dodać w v2 |
| Zawartość GPX | Ślad GPS + metadane (nazwa, dystans, sport, data) | Highlights jako waypointy w v2 |
| Ochrona dostępu | Brak (otwarty URL) | Każdy i tak musi mieć własne konto Komoot |
| Stack | SvelteKit + Node adapter (jedna apka: frontend + server-side proxy) | Mały bundle, prosty deploy |
| Deploy | Docker / docker-compose | Standardowe, izolowane, przenośne |
| Stan po stronie serwera | Brak (stateless) | Brak DB, brak Redisa; restart nie wylogowuje |

## 4. Architektura

```
┌──────────────┐    HTTPS       ┌─────────────────┐
│  przeglądarka│  (Cloudflare)  │  Cloudflare     │
│  (PWA)       │ ─────────────► │  Tunnel         │
└──────────────┘                └────────┬────────┘
                                         │ http (lokalnie)
                                         ▼
                                ┌─────────────────────────┐
                                │  Twój serwer            │
                                │  ┌───────────────────┐  │
                                │  │ Docker compose    │  │
                                │  │ ┌───────────────┐ │  │
                                │  │ │ SvelteKit Node│ │  │
                                │  │ │  • frontend   │ │  │
                                │  │ │  • /api/* —   │ │  │
                                │  │ │    proxy +    │ │  │
                                │  │ │    konwerter  │ │  │
                                │  │ │    GPX        │ │  │
                                │  │ └───────┬───────┘ │  │
                                │  └─────────┼─────────┘  │
                                └────────────┼────────────┘
                                             │ HTTPS
                                             ▼
                                ┌─────────────────────────┐
                                │  api.komoot.de          │
                                │  (nieoficjalne API)     │
                                └─────────────────────────┘
```

Jeden kontener Docker = jedna apka SvelteKit (Node adapter). W niej:
- **Frontend (PWA):** trasy Svelte (`/login`, `/`, opcjonalnie `/tour/[id]`).
- **Server endpoints (`/api/*`):** wołają `api.komoot.de`, parsują, generują GPX. Frontend nigdy nie woła Komoota bezpośrednio.

Cloudflare Tunnel działa osobno (istniejący lub jako drugi kontener `cloudflared` w `docker-compose.yml`).

## 5. Przepływ danych

### 5.1 Login (raz na wiele tygodni)

```
1. User wpisuje email + hasło Komoota na /login
2. Frontend → POST /api/auth { email, password }
3. Server → GET https://api.komoot.de/v006/account/email/{email}/
            Authorization: Basic base64(email:password)
4. Komoot zwraca: { username (numeric ID), password (token), ... }
5. Server → 200 { userId, token }   (hasło NIE jest zwracane do frontu)
6. Frontend zapisuje { email, userId, token } w localStorage
7. Redirect na / (lista tras)
```

Po tym kroku hasło nigdzie nie jest przechowywane. Token Komoota jest długo żyjący — działa do czasu zmiany hasła lub wylogowania w samym Komoot.

### 5.2 Lista tras

```
1. Frontend ładuje / → odczytuje { userId, token, email } z localStorage
2. Frontend → GET /api/tours?page=0
              Authorization: Basic base64(email:token)
3. Server → GET https://api.komoot.de/v007/users/{userId}/tours/
              ?type=tour_recorded,tour_planned&page=0&limit=24
              z tym samym Authorization
4. Komoot zwraca paginowany JSON z trasami (publiczne + prywatne — token daje dostęp do wszystkich)
5. Server mapuje na cienki kształt: [{ id, name, sport, date, distance, status }, ...]
6. Frontend renderuje listę z paginacją lub infinite scroll
```

### 5.3 Eksport GPX

```
1. User klika "Pobierz GPX" przy trasie
2. Frontend → GET /api/tours/{id}/gpx
              Authorization: Basic base64(email:token)
3. Server →
   a) GET .../v007/tours/{id}                 (metadane)
   b) GET .../v007/tours/{id}/coordinates      (punkty geo)
4. Server konwertuje do GPX XML (~50 linii kodu)
5. Server → 200 z Content-Type: application/gpx+xml
            Content-Disposition: attachment; filename="<nazwa-trasy>.gpx"
6. Przeglądarka pobiera plik
```

### 5.4 Wygaśnięcie tokenu

Komoot zwraca 401 → server propaguje 401 → frontend czyści localStorage → redirect `/login`. Brak refresh-token logiki.

## 6. Struktura kodu

```
komoot-to-gpx/
├── docker-compose.yml
├── Dockerfile
├── package.json
├── svelte.config.js          # adapter-node
├── vite.config.ts            # + @vite-pwa/sveltekit (auto-generuje service worker)
├── static/
│   ├── manifest.webmanifest
│   └── icons/
└── src/
    ├── app.html
    ├── lib/
    │   ├── server/
    │   │   ├── komoot.ts     # klient Komoot API — czyste funkcje async
    │   │   └── gpx.ts        # generator GPX XML — czysta funkcja
    │   └── client/
    │       └── session.ts    # localStorage: get/set/clear { email, userId, token }
    └── routes/
        ├── +layout.svelte    # wspólny header + guard (redirect na /login jeśli brak sesji)
        ├── +page.svelte      # lista tras (root /)
        ├── login/
        │   └── +page.svelte
        └── api/
            ├── auth/+server.ts
            ├── tours/+server.ts
            └── tours/[id]/gpx/+server.ts
```

### Granice modułów

- **`lib/server/komoot.ts`** — funkcje `login(email, password)`, `listTours(auth, page)`, `getTour(auth, id)`, `getCoordinates(auth, id)`. Nie zna SvelteKit. Robi `fetch` do `api.komoot.de`. Łatwo testowalne (mock `fetch`).
- **`lib/server/gpx.ts`** — `toGpx({ name, sport, date }, coordinates) → string`. Czysta funkcja, deterministyczna.
- **`lib/client/session.ts`** — wąski moduł z trzema funkcjami nad `localStorage`.
- **`routes/api/*`** — cienkie wrappery: parsują request, wołają `komoot.ts` + `gpx.ts`, zwracają response.

Każdy plik < 200 linii. Server ↔ klient nie współdzielą importów (oprócz typów).

## 7. Bezpieczeństwo i przechowywanie sesji

| Co | Gdzie | Dlaczego |
|---|---|---|
| Hasło Komoota | nigdzie (in-memory tylko podczas `/api/auth`) | Nigdy nie trafia do localStorage ani logów |
| Token Komoota | localStorage przeglądarki | Stateless serwer, restart nie wylogowuje |
| Email + userId | localStorage przeglądarki | Potrzebne do każdego requestu |

- `/api/auth` — rate limit po IP (5 prób / minutę, in-memory licznik). Ochrona przed brute-force.
- Logi nigdy nie zawierają hasła ani tokenu (filtr w `komoot.ts`).
- Brak zewnętrznych skryptów (CDN, analityka) — minimalna powierzchnia XSS.
- CSP `default-src 'self'`.

## 8. Obsługa błędów

| Scenariusz | Reakcja |
|---|---|
| Złe hasło | 401 → frontend pokazuje "nieprawidłowy email lub hasło" |
| Token wygasł | server propaguje 401 → frontend czyści localStorage → `/login` |
| Komoot 5xx / timeout | 502 → toast "Komoot nie odpowiada, spróbuj ponownie" |
| Komoot zmienił API | 502 z body `{ error: "komoot_unexpected_response" }` → toast "API Komoota się zmieniło" |
| Offline | Service worker → strona offline; lista pokazuje toast "brak sieci" |

Brak automatycznego retry. Jeśli request się nie uda, user klika ponownie.

## 9. Testowanie

- **`gpx.ts`** — Vitest na 3-4 przypadkach (krótka trasa, długa, znaki specjalne w nazwie). Asserty na strukturę XML.
- **`komoot.ts`** — Vitest z mockiem `fetch`. Weryfikacja: poprawne nagłówki, parsing odpowiedzi, propagacja błędów.
- **E2E (Playwright)** — flow login → lista → eksport. Wymaga prawdziwego konta Komoot z `.env.test`. Uruchamiane lokalnie (`pnpm test:e2e`), nie w publicznym CI.
- **Snapshot GPX** — wygenerowany plik dla zafiksowanej trasy porównany z fixture'em. Wykrywa zmiany w API Komoota.

Pokrycie celowe: ~70%, priorytet `gpx.ts` i `komoot.ts`. Komponenty Svelte — manualne testy podczas dev.

## 10. Deploy

- `Dockerfile` — multistage: build SvelteKit, runtime tylko Node + zbudowana apka.
- `docker-compose.yml` — usługa `app` (SvelteKit, port 3000 tylko lokalnie). Opcjonalnie druga usługa `cloudflared` z tokenem tunelu z env, jeśli użytkownik nie ma już osobnej instalacji `cloudflared` na serwerze.
- Restart policy: `unless-stopped`.
- Brak persistent volumes (apka stateless).

## 11a. Rozszerzenie: podgląd trasy na mapie (dodane po MVP)

- Klik na nazwę trasy w liście otwiera `/tour/[id]`.
- Strona renderuje mapę (Leaflet + tiles OpenStreetMap), polilinię trasy, znacznik startu/końca, podstawowe metadane (data, sport, dystans liczony z punktów, liczba próbek) oraz przycisk "Pobierz GPX".
- Nowy endpoint: `GET /api/tours/[id]/preview` — zwraca JSON `{ meta, coords: [{lat,lng,alt?}] }`. Endpoint dzieli z `gpx`-owym te same wywołania `getTour` + `getCoordinates`, ale wynik jest cieńszy (bez `t`, bez konwersji do XML).
- Leaflet i jego CSS importowane dynamicznie (`await import`), żeby nie powiększać bundla strony loginu / listy.
- Tiles z `tile.openstreetmap.org` z atrybucją OSM. Brak konta, brak api-key. Akceptowalne dla skali "rodzina/znajomi".

## 11. Co świadomie poza zakresem MVP

- Bulk export wielu tras / ZIP
- Filtry, wyszukiwanie, paginacja po stronie klienta z infinite scroll
- Highlights / waypointy w GPX
- Refresh-token / auto-relogin
- Internacjonalizacja (UI tylko po polsku)
- Wsparcie dla wielu kont Komoot na jednej przeglądarce
- Wrapper Capacitor / natywna apka iOS/Android
- Eksport do TCX / FIT
- Analityka, monitoring (Sentry itp.)
