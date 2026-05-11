<script lang="ts">
  interface Coord { lat: number; lng: number }

  let { coords, height = 96 }: { coords: Coord[]; height?: number } = $props();

  function project(points: Coord[], width: number, h: number) {
    if (points.length === 0) return { path: '', startX: 0, startY: 0, endX: 0, endY: 0 };

    let minLat = points[0].lat;
    let maxLat = points[0].lat;
    let minLng = points[0].lng;
    let maxLng = points[0].lng;
    for (const p of points) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }

    const pad = 8;
    const innerW = width - pad * 2;
    const innerH = h - pad * 2;

    const dLat = Math.max(maxLat - minLat, 1e-6);
    const dLng = Math.max(maxLng - minLng, 1e-6);

    // Mercator-ish horizontal scaling
    const latMid = (minLat + maxLat) / 2;
    const lngScale = Math.cos((latMid * Math.PI) / 180);
    const dLngScaled = dLng * lngScale;

    const ratio = innerW / innerH;
    const dataRatio = dLngScaled / dLat;
    let scale: number;
    let offsetX = 0;
    let offsetY = 0;
    if (dataRatio > ratio) {
      scale = innerW / dLngScaled;
      offsetY = (innerH - dLat * scale) / 2;
    } else {
      scale = innerH / dLat;
      offsetX = (innerW - dLngScaled * scale) / 2;
    }

    const xy = points.map((p) => {
      const x = pad + offsetX + (p.lng - minLng) * lngScale * scale;
      const y = pad + offsetY + (maxLat - p.lat) * scale;
      return [x, y] as const;
    });

    const path = xy.map(([x, y], i) => (i === 0 ? `M${x.toFixed(2)} ${y.toFixed(2)}` : `L${x.toFixed(2)} ${y.toFixed(2)}`)).join(' ');
    const [startX, startY] = xy[0];
    const [endX, endY] = xy[xy.length - 1];
    return { path, startX, startY, endX, endY };
  }

  const VIEW_W = 320;
  let projected = $derived(project(coords, VIEW_W, height));
</script>

<div class="mini-map" style="aspect-ratio: {VIEW_W} / {height};">
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 {VIEW_W} {height}"
    preserveAspectRatio="xMidYMid meet"
    role="img"
    aria-label="Podgląd kształtu trasy"
  >
    <defs>
      <pattern id="dots" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="0.5" fill="rgba(28,33,26,0.18)" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dots)" />
    {#if coords.length > 1}
      <path
        d={projected.path}
        fill="none"
        stroke="rgba(28,33,26,0.25)"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d={projected.path}
        fill="none"
        stroke="var(--color-terra)"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx={projected.startX} cy={projected.startY} r="3.5" fill="var(--color-forest)" />
      <circle cx={projected.endX} cy={projected.endY} r="3.5" fill="var(--color-terra-deep)" />
    {/if}
  </svg>
</div>

<style>
  .mini-map {
    width: 100%;
    background:
      linear-gradient(135deg, var(--color-paper-warm) 0%, var(--color-paper) 50%, var(--color-paper-warm) 100%);
    border-radius: 4px;
    overflow: hidden;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
