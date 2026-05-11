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
        errorMsg = 'Failed to load tour.';
        return;
      }
      const data = (await res.json()) as { meta: Meta; coords: Coord[] };
      meta = data.meta;
      coords = data.coords;
    } catch {
      errorMsg = 'Network error.';
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

    const shadow = L.polyline(latlngs, { color: 'rgba(0,0,0,0.18)', weight: 7, lineCap: 'round' });
    const line = L.polyline(latlngs, { color: '#0a0a0a', weight: 3.5, lineCap: 'round' });
    shadow.addTo(mapInstance);
    line.addTo(mapInstance);

    L.circleMarker(latlngs[0], {
      color: '#0a0a0a', weight: 2,
      fillColor: '#ffffff', fillOpacity: 1, radius: 7
    }).bindTooltip('Start', { permanent: false }).addTo(mapInstance);

    L.circleMarker(latlngs[latlngs.length - 1], {
      color: '#ffffff', weight: 2,
      fillColor: '#0a0a0a', fillOpacity: 1, radius: 7
    }).bindTooltip('Finish', { permanent: false }).addTo(mapInstance);

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
        errorMsg = 'Download failed.';
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
    return new Date(iso).toLocaleDateString('en-US', {
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
    racebike: 'Road',
    touringbicycle: 'Gravel',
    mtb: 'MTB',
    hike: 'Hike',
    jogging: 'Run',
    e_racebike: 'E-Road',
    e_mtb: 'E-MTB',
    e_touringbicycle: 'E-Trekking'
  };
  function fmtSport(s: string): string {
    return sportLabel[s] ?? s.replace(/_/g, ' ');
  }

  const komootUrl = $derived(meta ? `https://www.komoot.com/tour/${meta.id}` : '#');

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
  Back to tours
</a>

{#if loading}
  <p class="status">Loading tour…</p>
{:else if errorMsg}
  <p class="error">{errorMsg}</p>
{:else if meta}
  <header class="hero">
    <div class="hero-meta">
      <span class="kicker">{fmtSport(meta.sport)} · {fmtDate(meta.date)}</span>
    </div>
    <h1>{meta.name}</h1>
    <div class="hero-actions">
      <a class="action action-secondary" href={komootUrl} target="_blank" rel="noopener noreferrer">
        View on Komoot
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M4 2h6v6M10 2L4 8M2 5v5h5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </a>
      <button class="action action-primary" onclick={downloadGpx} disabled={downloading}>
        {#if downloading}
          <span class="spinner" aria-hidden="true"></span>
          Downloading…
        {:else}
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M8 2v9m0 0l-3-3m3 3l3-3M3 14h10" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Download GPX
        {/if}
      </button>
    </div>
  </header>

  <dl class="stats">
    <div>
      <dt>Distance</dt>
      <dd>{fmtDist()}</dd>
    </div>
    <div>
      <dt>Elevation gain</dt>
      <dd>{elevationGain()}</dd>
    </div>
    <div>
      <dt>GPS points</dt>
      <dd>{coords.length.toLocaleString('en-US')}</dd>
    </div>
  </dl>

  <div class="map" bind:this={mapEl}></div>
{/if}

<style>
  .back {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--color-fg-muted);
    text-decoration: none;
    font-size: 0.85rem;
    margin-bottom: 1.5rem;
    transition: color 0.15s;
  }
  .back:hover { color: var(--color-fg); }

  .hero {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }
  .hero-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
    flex-wrap: wrap;
  }
  .kicker {
    display: inline-block;
    font-size: 0.78rem;
    color: var(--color-fg-muted);
    font-weight: 500;
  }
  h1 { margin: 0; }

  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem 2.5rem;
    border-top: 1px solid var(--color-border);
    border-bottom: 1px solid var(--color-border);
    padding: 1.2rem 0;
    margin: 1.5rem 0;
  }
  .stats > div { display: flex; flex-direction: column; gap: 0.3rem; }
  dt {
    font-size: 0.78rem;
    color: var(--color-fg-muted);
    font-weight: 500;
  }
  dd {
    margin: 0;
    font-size: 1.5rem;
    color: var(--color-fg);
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .action {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    height: 38px;
    padding: 0 1rem;
    border-radius: var(--radius-sm);
    font-size: 0.88rem;
    font-weight: 500;
    border: 1px solid transparent;
    transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.15s;
    cursor: pointer;
  }
  .action-primary {
    background: var(--color-fg);
    color: var(--color-bg);
  }
  .action-primary:hover { background: var(--color-accent); }
  .action-primary:active { transform: scale(0.98); }
  .action-primary:disabled { opacity: 0.6; cursor: progress; }
  .action-secondary {
    background: var(--color-bg);
    color: var(--color-fg);
    border-color: var(--color-border);
  }
  .action-secondary:hover {
    background: var(--color-bg-soft);
    border-color: var(--color-border-strong);
  }

  .map {
    width: 100%;
    height: 60vh;
    min-height: 360px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .spinner {
    width: 11px; height: 11px;
    border: 1.5px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .status, .error {
    text-align: center;
    color: var(--color-fg-subtle);
    margin: 3rem 0;
  }
  .error { color: var(--color-error); }

  :global(.leaflet-container) {
    font-family: var(--font-body);
    background: var(--color-bg-soft) !important;
  }
  :global(.leaflet-control-zoom a) {
    background: var(--color-bg) !important;
    color: var(--color-fg) !important;
    border-color: var(--color-border) !important;
  }
</style>
