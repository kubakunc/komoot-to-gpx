# Handoff: Ikona aplikacji — Eksport tras GPX

## Overview
Ikona (app icon) dla mobilnej aplikacji do **eksportu plików GPX dla Strava i Komoot**.
Koncept finalny: **„Podział wzdłuż trasy"** — biała linia aktywności jest jednocześnie
granicą między pomarańczem Stravy (nad linią) a zielenią Komoot (pod linią). W prawym
dolnym rogu znajduje się **plakietka pobierania** (kółko ze strzałką w dół), która
komunikuje główną funkcję: pobieranie / eksport GPX.

> **Nazwa „Eksport tras GPX" jest robocza (placeholder).** Podstaw finalną nazwę aplikacji
> w `brandbook.html` (sekcja cover) oraz w manifestach iOS/Android.

## About the Design Files
Pliki w tym pakiecie to **referencje projektowe** — definicja wyglądu marki/ikony, nie
gotowy kod produkcyjny do skopiowania 1:1. Zadaniem jest **odtworzenie tej ikony w
docelowym środowisku** (Xcode asset catalog, Android adaptive icon, PWA manifest,
komponent React/Vue itd.) z użyciem natywnych mechanizmów platformy. SVG master jest
źródłem prawdy dla geometrii i kolorów — rasteryzuj go do wymaganych rozmiarów PNG.

## Fidelity
**High-fidelity.** Kolory, geometria, grubości linii i proporcje są finalne i dokładne
(wartości w przestrzeni 100×100, skala ×10,24 → 1024 px). Odtwórz pixel-perfect.

## The Asset (jedna ikona, wiele wyprowadzeń)

**Nazwa:** App Icon — „Route divider"
**Przestrzeń projektowa:** `viewBox 0 0 100 100` (kwadrat, full-bleed)
**Format master:** SVG (`assets/icon-master.svg`)

### Budowa (warstwy od spodu)
1. **Tło** — pełny prostokąt `#FC4C02` (Strava orange).
2. **Pole zieleni** — `#5E9E2E` (Komoot green); jego górna krawędź biegnie dokładnie
   po ścieżce trasy:
   `M0 57 L22 53 C 30 53, 33 43, 41 45 C 47 46, 50 59, 58 52 C 64 47, 69 35, 77 33 L100 28 L100 100 L0 100 Z`
3. **Trasa (linia aktywności)** — `#FFFFFF`, leży na szwie kolorów:
   `M22 53 C 30 53, 33 43, 41 45 C 47 46, 50 59, 58 52 C 64 47, 69 35, 77 33`
   `stroke-width: 6.5`, `stroke-linecap: round`, `stroke-linejoin: round`.
4. **Kropki końcowe trasy** — `#FFFFFF`, `r 4.6` w punktach `(22,53)` i `(77,33)`.
5. **Plakietka pobierania** — białe koło `r 14.5` w `(72, 73.5)`.
6. **Strzałka pobierania** — `#15191C`, `stroke-width 3.3`, round cap/join:
   - trzon: `M72 66.5 V76`
   - grot: `M66.8 71.6 L72 77 L77.2 71.6`
   - podstawka: `M66 80.5 H78`

### Zaokrąglenie narożników
Master jest **full-bleed (bez własnego zaokrąglenia)** — kształt nakłada system
operacyjny. Do podglądu używamy aproksymacji squircle iOS: `rx = 22.37%`
(`assets/icon-rounded.svg`).

## Design Tokens
```
--icon-orange : #FC4C02   /* Strava — tło nad trasą; rgb(252,76,2)  */
--icon-green  : #5E9E2E   /* Komoot — pole pod trasą; rgb(94,158,46) */
--icon-ink    : #15191C   /* strzałka pobierania; rgb(21,25,28)      */
--icon-white  : #FFFFFF   /* trasa + plakietka                       */

route-stroke-width : 6.5   (w przestrzeni 100; round cap & join)
arrow-stroke-width : 3.3
badge             : circle r=14.5 @ (72, 73.5)
route-end-dots    : r=4.6 @ (22,53) i (77,33)
ios-corner-radius : 22.37%  (tylko podgląd; system maskuje)
```
Brak gradientów — duotone jest **płaski** (dwa pełne kolory).

## Typografia (dla UI/wordmark aplikacji — ikona jest bez tekstu)
Ikona to czysty symbol (bez liter). Rekomendacja dla reszty marki/UI:
- **Display / nagłówki:** Space Grotesk (geometryczny, „sportowy" charakter)
- **Body / UI:** Hanken Grotesk lub systemowy `system-ui`
Brandbook używa tych krojów (Google Fonts).

## Eksport — matryca rozmiarów

### iOS (Asset Catalog)
- **1024×1024 PNG** — App Store / „single size" w Xcode 14+ (generuje resztę).
- Jeśli ręcznie: 180, 120, 87, 80, 60, 58, 40, 29 px (PNG, bez przezroczystości,
  bez zaokrągleń — iOS maskuje sam).

### Android
- **Adaptive icon** (`res/mipmap-anydpi-v26/ic_launcher.xml`):
  - `background` = duotone (orange + green, podział wzdłuż trasy),
  - `foreground` = trasa (biała) + plakietka pobierania.
  - Kanwa 108dp; **strefa bezpieczna = centralne 66dp (≈ koło 72%)**.
  - ⚠️ **Uwaga:** plakietka pobierania w masterze sięga rogu (do ~88/100), więc maska
    kołowa może ją przyciąć. Dla adaptive **przeskaluj warstwę foreground do ~80% i
    wyśrodkuj**, tak by badge mieścił się w strefie bezpiecznej — albo użyj mastera
    jako pojedynczej ikony legacy/themed.
- **Legacy `ic_launcher`** (PNG): 48 / 72 / 96 / 144 / 192 px (mdpi…xxxhdpi).
- **Google Play:** 512×512 PNG.

### Web / PWA
- `manifest.json` icons: 192, 512 px (PNG).
- `apple-touch-icon`: 180 px. Favicon: 32, 16 px. (lub samo `icon.svg`).

## Interactions & Behavior
Ikona statyczna — brak interakcji. (Opcjonalnie: subtelny „bounce"/scale przy launchu,
jeśli platforma na to pozwala — nie jest wymagane.)

## Files (w tym pakiecie)
```
design_handoff_app_icon/
├── README.md                  ← ten plik (specyfikacja + tokeny + eksport)
├── brandbook.html             ← wizualny brand book (otwórz w przeglądarce)
├── assets/
│   ├── icon-master.svg        ← MASTER, full-bleed 1024 (źródło prawdy)
│   ├── icon-rounded.svg       ← podgląd z zaokrągleniem iOS (squircle)
│   ├── icon-1024.png          ← raster full-bleed (App Store / Play)
│   ├── icon-1024-rounded.png  ← raster z zaokrągleniem (podgląd/marketing)
│   ├── AppIcon.jsx            ← komponent React (size, rounded)
│   └── icons-source.jsx       ← źródło wszystkich 10 wariacji duotone (referencja)
```

## Implementacja — React (przykład)
```jsx
import AppIcon from './assets/AppIcon';

<AppIcon size={64} />          // full-bleed (kontener nadaje zaokrąglenie)
<AppIcon size={64} rounded />  // podgląd z zaokrągleniem iOS
```
`AppIcon.jsx` eksportuje też `ICON_TOKENS` (kolory) do reużycia w UI.

## Notatki dla dewelopera
- Trzymaj się dokładnych wartości geometrii — biała linia **musi** leżeć na granicy
  kolorów (ta sama ścieżka definiuje krawędź zieleni i linię), inaczej pojawi się
  cienka szczelina/aliasing na szwie.
- Renderuj PNG z mastera SVG (np. `resvg`, `sharp`, `rsvg-convert`) — nie skaluj PNG→PNG.
- Bez przezroczystości w eksportach na store'y; tło zawsze pełne (orange/green).
- Reguły „czego nie robić" — patrz sekcja 06 w `brandbook.html`.
