<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { getSession, clearSession } from '$lib/client/session';
  import { getTour, getCoordinates, KomootError, type Coordinate, type TourMetadata } from '$lib/client/komoot';
  import { toGpx } from '$lib/client/gpx';
  import { saveGpxFile, SaveCancelledError } from '$lib/client/gpx-saver';

  let meta = $state<TourMetadata | null>(null);
  let coords = $state<Coordinate[]>([]);
  let loading = $state(true);
  let errorMsg = $state<string | null>(null);
  let downloading = $state(false);
  let mapEl = $state<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mapInstance: any = null;

  $effect(() => {
    if (mapEl && coords.length > 0 && !mapInstance) void renderMap(mapEl, coords);
  });

  async function load() {
    const s = await getSession();
    if (!s) { await goto('/login', { replaceState: true }); return; }
    try {
      const id = $page.params.id;
      if (!id) { errorMsg = 'Missing tour id.'; return; }
      meta = await getTour(s, id);
      coords = await getCoordinates(s, id, meta.date);
    } catch (e) {
      if (e instanceof KomootError && e.status === 401) {
        await clearSession();
        await goto('/login', { replaceState: true });
        return;
      }
      errorMsg = 'Failed to load tour.';
    } finally { loading = false; }
  }

  async function renderMap(el: HTMLDivElement, points: Coordinate[]) {
    const L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');
    const latlngs = points.map((c) => [c.lat, c.lng] as [number, number]);
    mapInstance = L.map(el, { scrollWheelZoom: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mapInstance);
    if (latlngs.length === 0) { mapInstance.setView([52, 19], 6); return; }
    L.polyline(latlngs, { color: 'rgba(0,0,0,0.18)', weight: 7 }).addTo(mapInstance);
    const line = L.polyline(latlngs, { color: '#0a0a0a', weight: 3.5 }).addTo(mapInstance);
    L.circleMarker(latlngs[0], { color: '#0a0a0a', fillColor: '#fff', fillOpacity: 1, radius: 7 }).addTo(mapInstance);
    L.circleMarker(latlngs[latlngs.length - 1], { color: '#fff', fillColor: '#0a0a0a', fillOpacity: 1, radius: 7 }).addTo(mapInstance);
    mapInstance.fitBounds(line.getBounds(), { padding: [30, 30] });
  }

  function safeName(name: string): string {
    return (name.replace(/[^\p{L}\p{N}\-_ ]+/gu, '').trim().replace(/\s+/g, '_') || 'tour');
  }

  async function downloadGpx() {
    if (!meta) return;
    downloading = true;
    errorMsg = null;
    try {
      const xml = toGpx({ name: meta.name, sport: meta.sport, startTimeIso: meta.date }, coords);
      const filename = safeName(meta.name) + '.gpx';
      await saveGpxFile(filename, xml);
      errorMsg = `Saved ${filename}`;
    } catch (err) {
      if (err instanceof SaveCancelledError) { errorMsg = null; return; }
      errorMsg = 'Download failed.';
    } finally { downloading = false; }
  }

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  function fmtDist(): string {
    if (coords.length < 2) return '—';
    let m = 0;
    for (let i = 1; i < coords.length; i++) m += haversine(coords[i - 1], coords[i]);
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
  function haversine(a: Coordinate, b: Coordinate): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat); const dLng = toRad(b.lng - a.lng);
    const x = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const komootUrl = $derived(meta ? `https://www.komoot.com/tour/${meta.id}` : '#');

  onMount(() => void load());
  onDestroy(() => { if (mapInstance) { mapInstance.remove(); mapInstance = null; } });
</script>

<a class="back" href="/">← Back to tours</a>

{#if loading}<p class="status">Loading tour…</p>
{:else if errorMsg && !meta}<p class="error">{errorMsg}</p>
{:else if meta}
  <header class="hero">
    <h1>{meta.name}</h1>
    <div class="hero-actions">
      <a class="action action-secondary" href={komootUrl} target="_blank" rel="noopener noreferrer">View on Komoot</a>
      <button class="action action-primary" onclick={downloadGpx} disabled={downloading}>
        {downloading ? 'Saving…' : 'Download GPX'}
      </button>
    </div>
    {#if errorMsg}<p class="error">{errorMsg}</p>{/if}
  </header>

  <dl class="stats">
    <div><dt>Distance</dt><dd>{fmtDist()}</dd></div>
    <div><dt>Elevation gain</dt><dd>{elevationGain()}</dd></div>
    <div><dt>GPS points</dt><dd>{coords.length}</dd></div>
  </dl>

  <div class="map" bind:this={mapEl}></div>
{/if}

<style>
  .back { display: inline-block; color: var(--color-fg-muted);
    font-size: 0.85rem; margin-bottom: 1.5rem; text-decoration: none; }
  .back:hover { color: var(--color-fg); }
  .hero { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem; }
  .hero-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem 2.5rem; border-top: 1px solid var(--color-border);
    border-bottom: 1px solid var(--color-border); padding: 1.2rem 0; margin: 1.5rem 0; }
  .stats > div { display: flex; flex-direction: column; gap: 0.3rem; }
  dt { font-size: 0.78rem; color: var(--color-fg-muted); font-weight: 500; }
  dd { margin: 0; font-size: 1.5rem; font-weight: 600; }
  .action { display: inline-flex; align-items: center; gap: 0.4rem;
    height: 38px; padding: 0 1rem; border-radius: var(--radius-sm);
    font-size: 0.88rem; font-weight: 500; border: 1px solid transparent;
    text-decoration: none; }
  .action-primary { background: var(--color-fg); color: var(--color-bg); }
  .action-primary:hover { background: var(--color-accent); }
  .action-primary:disabled { opacity: 0.6; cursor: progress; }
  .action-secondary { background: var(--color-bg); color: var(--color-fg);
    border-color: var(--color-border); }
  .action-secondary:hover { background: var(--color-bg-soft); border-color: var(--color-border-strong); }
  .map { width: 100%; height: 60vh; min-height: 360px;
    border: 1px solid var(--color-border); border-radius: var(--radius); overflow: hidden; }
  .status, .error { text-align: center; color: var(--color-fg-subtle); margin: 1rem 0; }
  .error { color: var(--color-error); }
</style>
