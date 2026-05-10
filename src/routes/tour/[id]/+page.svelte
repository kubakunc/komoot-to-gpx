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
    mapInstance = L.map(el, { scrollWheelZoom: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mapInstance);

    if (latlngs.length === 0) {
      mapInstance.setView([52, 19], 6);
      return;
    }

    const line = L.polyline(latlngs, { color: '#1a73e8', weight: 4 }).addTo(mapInstance);
    L.circleMarker(latlngs[0], { color: '#2e7d32', radius: 6, fillOpacity: 1 })
      .bindTooltip('start')
      .addTo(mapInstance);
    L.circleMarker(latlngs[latlngs.length - 1], { color: '#c62828', radius: 6, fillOpacity: 1 })
      .bindTooltip('koniec')
      .addTo(mapInstance);
    mapInstance.fitBounds(line.getBounds(), { padding: [20, 20] });
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
      month: 'short',
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

<div class="header">
  <a href="/" class="back">← lista</a>
  {#if meta}
    <h1>{meta.name}</h1>
  {/if}
</div>

{#if loading}
  <p>Ładuję trasę…</p>
{:else if errorMsg}
  <p class="error">{errorMsg}</p>
{:else if meta}
  <div class="meta">
    <span>{fmtDate(meta.date)}</span>
    <span>·</span>
    <span>{meta.sport}</span>
    <span>·</span>
    <span>{fmtDist()}</span>
    <span>·</span>
    <span>{coords.length} punktów</span>
  </div>

  <div class="map" bind:this={mapEl}></div>

  <button class="download" onclick={downloadGpx} disabled={downloading}>
    {downloading ? 'pobieram…' : 'Pobierz GPX'}
  </button>
{/if}

<style>
  .header { display: flex; align-items: baseline; gap: 1rem; margin-bottom: 0.5rem; }
  .back { color: var(--color-accent); text-decoration: none; }
  .back:hover { text-decoration: underline; }
  h1 { margin: 0; font-size: 1.4rem; }
  .meta { display: flex; flex-wrap: wrap; gap: 0.4rem; color: #666; font-size: 0.9rem; margin-bottom: 0.75rem; }
  .map {
    width: 100%;
    height: 60vh;
    min-height: 320px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    overflow: hidden;
  }
  .download {
    margin-top: 1rem;
    padding: 0.6rem 1rem;
    background: var(--color-accent);
    color: white;
    border: 0;
    border-radius: 4px;
  }
  .download:disabled { opacity: 0.5; }
  .error { color: var(--color-error); }
</style>
