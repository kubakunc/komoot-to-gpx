<script lang="ts">
  import { onDestroy } from 'svelte';

  interface Coord { lat: number; lng: number }

  let { coords, height = 112 }: { coords: Coord[]; height?: number } = $props();

  let mapEl = $state<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mapInstance: any = null;

  $effect(() => {
    if (mapEl && coords.length > 1 && !mapInstance) void renderMap(mapEl, coords);
  });

  async function renderMap(el: HTMLDivElement, points: Coord[]) {
    const L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');
    const latlngs = points.map((c) => [c.lat, c.lng] as [number, number]);
    mapInstance = L.map(el, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(mapInstance);
    L.polyline(latlngs, { color: 'rgba(0,0,0,0.25)', weight: 5 }).addTo(mapInstance);
    const line = L.polyline(latlngs, { color: '#0a0a0a', weight: 2.5 }).addTo(mapInstance);
    L.circleMarker(latlngs[0], { color: '#0a0a0a', fillColor: '#fff', fillOpacity: 1, radius: 4, weight: 1.5 }).addTo(mapInstance);
    L.circleMarker(latlngs[latlngs.length - 1], { color: '#fff', fillColor: '#0a0a0a', fillOpacity: 1, radius: 4, weight: 1.5 }).addTo(mapInstance);
    mapInstance.fitBounds(line.getBounds(), { padding: [12, 12], animate: false });
  }

  onDestroy(() => {
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
  });
</script>

<div class="mini-map" style="height: {height}px;" bind:this={mapEl}></div>

<style>
  .mini-map {
    width: 100%;
    background: var(--color-bg-soft);
    border-bottom: 1px solid var(--color-border);
  }
  .mini-map :global(.leaflet-container) {
    background: var(--color-bg-soft);
    font-family: inherit;
  }
</style>
