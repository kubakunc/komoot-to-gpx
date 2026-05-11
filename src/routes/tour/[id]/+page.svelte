<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { authHeader, clearSession, getSession } from '$lib/client/session';

  interface Coord { lat: number; lng: number; alt?: number }
  interface Meta { id: string; name: string; sport: string; date: string }

  let meta = $state<Meta | null>(null);
  let coords = $state<Coord[]>([]);
  let loading = $state(true);
  let errorMsg = $state<string | null>(null);
  let downloading = $state(false);
  let mapEl = $state<HTMLDivElement | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mapInstance: any = null;

  $effect(() => {
    if (mapEl && coords.length > 0 && !mapInstance) {
      void renderMap(mapEl, coords);
    }
  });

  async function load() {
    const s = getSession();
    const id = $page.params.id;
    if (!s) {
      await goto('/login', { replaceState: true });
      return;
    }
    try {
      const res = await fetch(`/api/tours/${id}/preview`, {
        headers: { authorization: authHeader(s) }
      });
      if (res.status === 401) {
        clearSession();
        await goto('/login', { replaceState: true });
        return;
      }
      if (!res.ok) {
        errorMsg = 'Nie udało się załadować trasy.';
        return;
      }
      const data = (await res.json()) as { meta: Meta; coords: Coord[] };
      meta = data.meta;
      coords = data.coords;
    } catch {
      errorMsg = 'Brak połączenia.';
    } finally {
      loading = false;
    }
  }

  async function renderMap(el: HTMLDivElement, points: Coord[]) {
    const L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');

    const latlngs = points.map((c) => [c.lat, c.lng] as [number, number]);
    mapInstance = L.map(el, { scrollWheelZoom: true, zoomControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mapInstance);

    if (latlngs.length === 0) {
      mapInstance.setView([52, 19], 6);
      return;
    }

    const shadow = L.polyline(latlngs, { color: 'rgba(28,33,26,0.35)', weight: 7, lineCap: 'round' });
    const line = L.polyline(latlngs, { color: '#b75941', weight: 4, lineCap: 'round' });
    shadow.addTo(mapInstance);
    line.addTo(mapInstance);

    L.circleMarker(latlngs[0], {
      color: 'white', weight: 2,
      fillColor: '#2d4030', fillOpacity: 1, radius: 7
    }).bindTooltip('start', { permanent: false }).addTo(mapInstance);

    L.circleMarker(latlngs[latlngs.length - 1], {
      color: 'white', weight: 2,
      fillColor: '#8a3e2a', fillOpacity: 1, radius: 7
    }).bindTooltip('koniec', { permanent: false }).addTo(mapInstance);

    mapInstance.fitBounds(line.getBounds(), { padding: [30, 30] });
  }

  function safeName(name: string): string {
    return (
      name
        .replace(/[^\p{L}\p{N}\-_ ]+/gu, '')
        .trim()
        .replace(/\s+/g, '_') || 'tour'
    );
  }

  async function downloadGpx() {
    const s = getSession();
    if (!s || !meta) return;
    downloading = true;
    errorMsg = null;
    try {
      const res = await fetch(`/api/tours/${meta.id}/gpx`, {
        headers: { authorization: authHeader(s) }
      });
      if (res.status === 401) {
        clearSession();
        await goto('/login', { replaceState: true });
        return;
      }
      if (!res.ok) {
        errorMsg = 'Pobieranie nie powiodło się.';
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName(meta.name)}.gpx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      downloading = false;
    }
  }

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function fmtDist(): string {
    if (coords.length < 2) return '—';
    let m = 0;
    for (let i = 1; i < coords.length; i++) {
      m += haversine(coords[i - 1], coords[i]);
    }
    return (m / 1000).toFixed(1) + ' km';
  }

  function elevationGain(): string {
    if (coords.length < 2) return '—';
    let gain = 0;
    for (let i = 1; i < coords.length; i++) {
      const d = (coords[i].alt ?? 0) - (coords[i - 1].alt ?? 0);
      if (d > 0) gain += d;
    }
    return Math.round(gain) + ' m';
  }

  function haversine(a: Coord, b: Coord): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  const sportLabel: Record<string, string> = {
    racebike: 'szosa',
    touringbicycle: 'gravel',
    mtb: 'MTB',
    hike: 'pieszo',
    jogging: 'bieg',
    e_racebike: 'e-szosa',
    e_mtb: 'e-MTB',
    e_touringbicycle: 'e-trekking'
  };
  function fmtSport(s: string): string {
    return sportLabel[s] ?? s.replace(/_/g, ' ');
  }

  onMount(() => {
    void load();
  });

  onDestroy(() => {
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
  });
</script>

<a class="back" href="/">
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <path d="M10 3l-5 5 5 5" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
  wróć do listy
</a>

{#if loading}
  <p class="status">— Ładuję trasę… —</p>
{:else if errorMsg}
  <p class="error">{errorMsg}</p>
{:else if meta}
  <header class="hero">
    <span class="kicker">{fmtSport(meta.sport)} · {fmtDate(meta.date)}</span>
    <h1>{meta.name}</h1>
  </header>

  <dl class="stats">
    <div>
      <dt>dystans</dt>
      <dd>{fmtDist()}</dd>
    </div>
    <div>
      <dt>przewyższenie</dt>
      <dd>{elevationGain()}</dd>
    </div>
    <div>
      <dt>punkty GPS</dt>
      <dd>{coords.length.toLocaleString('pl-PL')}</dd>
    </div>
    <div>
      <dt>akcja</dt>
      <dd>
        <button class="download" onclick={downloadGpx} disabled={downloading}>
          {#if downloading}
            <span class="spinner" aria-hidden="true"></span>
            pobieram…
          {:else}
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M8 2v9m0 0l-3-3m3 3l3-3M3 14h10" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            pobierz GPX
          {/if}
        </button>
      </dd>
    </div>
  </dl>

  <div class="map" bind:this={mapEl}></div>
{/if}

<style>
  .back {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--color-ink-soft);
    text-decoration: none;
    font-size: 0.85rem;
    letter-spacing: 0.04em;
    margin-bottom: 1.5rem;
    transition: color 0.15s;
  }
  .back:hover { color: var(--color-terra); }

  .hero { margin-bottom: 1.2rem; }
  .kicker {
    display: inline-block;
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-terra);
    font-weight: 600;
    margin-bottom: 0.4rem;
  }
  h1 { margin: 0; }

  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem;
    border-top: 1px solid var(--border-subtle);
    border-bottom: 1px solid var(--border-subtle);
    padding: 1.1rem 0;
    margin: 1.5rem 0;
  }
  .stats > div { display: flex; flex-direction: column; gap: 0.3rem; }
  dt {
    font-size: 0.65rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--color-sage);
    font-weight: 600;
  }
  dd {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.4rem;
    color: var(--color-ink);
    line-height: 1;
    font-variation-settings: 'opsz' 144, 'SOFT' 30;
  }
  dd:has(.download) { font-family: var(--font-body); font-size: inherit; }

  .download {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 1rem;
    background: var(--color-ink);
    color: var(--color-paper);
    border: 0;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    transition: background 0.15s, transform 0.15s;
  }
  .download:hover { background: var(--color-terra); }
  .download:active { transform: scale(0.97); }
  .download:disabled { opacity: 0.6; cursor: progress; }

  .map {
    width: 100%;
    height: 60vh;
    min-height: 360px;
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 24px 50px -30px rgba(28, 33, 26, 0.35);
  }

  .spinner {
    width: 10px; height: 10px;
    border: 1.5px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .status, .error {
    text-align: center;
    color: var(--color-sage);
    letter-spacing: 0.06em;
    margin: 3rem 0;
  }
  .error { color: var(--color-error); }

  :global(.leaflet-container) {
    font-family: var(--font-body);
    background: var(--color-paper-warm) !important;
  }
  :global(.leaflet-control-zoom a) {
    background: var(--color-paper) !important;
    color: var(--color-ink) !important;
    border-color: var(--border-subtle) !important;
  }
</style>
