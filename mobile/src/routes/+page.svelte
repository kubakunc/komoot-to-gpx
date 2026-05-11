<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getSession, clearSession } from '$lib/client/session';
  import {
    listTours, getTour, getCoordinates, downsample,
    KomootError, type TourSummary, type Coordinate
  } from '$lib/client/komoot';
  import { toGpx } from '$lib/client/gpx';
  import MiniMap from '$lib/client/MiniMap.svelte';
  import SavedModal from '$lib/client/SavedModal.svelte';
  import { saveGpxFile, SaveCancelledError } from '$lib/client/gpx-saver';
  import { showBanner, hideBanner, maybeShowInterstitial } from '$lib/client/ad-banner';
  import { PHASE2 } from '$lib/client/ad-config';

  const SAVE_COUNT_KEY = 'gpx-exporter:save-count';
  let savedModalFilename = $state<string | null>(null);

  let tours = $state<TourSummary[]>([]);
  let page = $state(0);
  let totalPages = $state(1);
  let loading = $state(false);
  let errorMsg = $state<string | null>(null);
  let downloading = $state<string | null>(null);
  let shapes = $state<Record<string, Coordinate[] | 'loading' | 'error'>>({});

  async function loadPage(p: number) {
    const s = await getSession();
    if (!s) return;
    loading = true;
    errorMsg = null;
    try {
      const data = await listTours(s, { userId: s.userId, page: p });
      tours = p === 0 ? data.tours : [...tours, ...data.tours];
      totalPages = data.totalPages;
      page = data.page;
    } catch (e) {
      if (e instanceof KomootError && e.status === 401) {
        await clearSession();
        await goto('/login', { replaceState: true });
        return;
      }
      errorMsg = 'Failed to load tours.';
    } finally {
      loading = false;
    }
  }

  async function loadShape(id: string) {
    if (shapes[id]) return;
    const s = await getSession();
    if (!s) return;
    shapes = { ...shapes, [id]: 'loading' };
    try {
      const meta = await getTour(s, id);
      const coords = await getCoordinates(s, id, meta.date);
      shapes = { ...shapes, [id]: downsample(coords, 160) };
    } catch {
      shapes = { ...shapes, [id]: 'error' };
    }
  }

  function observeCard(node: HTMLElement, id: string) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            void loadShape(id);
            io.disconnect();
          }
        }
      },
      { rootMargin: '200px 0px' }
    );
    io.observe(node);
    return { destroy() { io.disconnect(); } };
  }

  function safeName(name: string): string {
    return (
      name.replace(/[^\p{L}\p{N}\-_ ]+/gu, '').trim().replace(/\s+/g, '_') || 'tour'
    );
  }

  async function download(t: TourSummary, e: MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const s = await getSession();
    if (!s) return;
    downloading = t.id;
    errorMsg = null;
    try {
      const meta = await getTour(s, t.id);
      const coords = await getCoordinates(s, t.id, meta.date);
      const xml = toGpx(
        { name: meta.name, sport: meta.sport, startTimeIso: meta.date },
        coords
      );
      const filename = safeName(meta.name) + '.gpx';
      await saveGpxFile(filename, xml);
      const count = Number(localStorage.getItem(SAVE_COUNT_KEY) ?? '0') + 1;
      localStorage.setItem(SAVE_COUNT_KEY, String(count));
      if (count % PHASE2.INTERSTITIAL_EVERY_NTH_SAVE === 0) {
        void maybeShowInterstitial();
      }
      savedModalFilename = filename;
    } catch (err) {
      if (err instanceof SaveCancelledError) {
        errorMsg = null;
        return;
      }
      if (err instanceof KomootError && err.status === 401) {
        await clearSession();
        await goto('/login', { replaceState: true });
        return;
      }
      errorMsg = 'Download failed.';
    } finally {
      downloading = null;
    }
  }

  const sportLabel: Record<string, string> = {
    racebike: 'Road', touringbicycle: 'Gravel', mtb: 'MTB',
    hike: 'Hike', jogging: 'Run',
    e_racebike: 'E-Road', e_mtb: 'E-MTB', e_touringbicycle: 'E-Trekking'
  };
  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtDist(m: number): string { return (m / 1000).toFixed(1) + ' km'; }
  function fmtSport(s: string): string { return sportLabel[s] ?? s.replace(/_/g, ' '); }
  const komootUrl = (id: string) => `https://www.komoot.com/tour/${id}`;

  onMount(() => {
    void loadPage(0);
    void showBanner();
    return () => { void hideBanner(); };
  });
</script>

<section class="intro">
  <h1>Your tours.</h1>
  <p class="lede">Every recorded and planned route from your Komoot account — ready to download as GPX.</p>
</section>

{#if errorMsg}<p class="error">{errorMsg}</p>{/if}

<ul class="tours">
  {#each tours as t, i (t.id)}
    <li class="card" style="animation-delay: {Math.min(i, 8) * 30}ms" use:observeCard={t.id}>
      <a class="card-link" href={`/tour/${t.id}`}>
        <div class="card-map">
          {#if shapes[t.id] && shapes[t.id] !== 'loading' && shapes[t.id] !== 'error'}
            <MiniMap coords={shapes[t.id] as Coordinate[]} />
          {:else if shapes[t.id] === 'error'}
            <div class="map-fallback">preview unavailable</div>
          {:else}
            <div class="map-skeleton" aria-hidden="true"></div>
          {/if}
        </div>
        <div class="card-body">
          <div class="card-meta">
            <span class="badge">{fmtSport(t.sport)}</span>
            <span class="badge badge-status" class:badge-public={t.status === 'public'}>
              {t.status === 'public' ? 'Public' : 'Private'}
            </span>
            <span class="badge badge-light">{t.type === 'tour_planned' ? 'Planned' : 'Completed'}</span>
          </div>
          <strong class="card-title">{t.name}</strong>
          <div class="card-stats">
            <span class="stat"><span class="stat-num">{fmtDist(t.distance)}</span><span class="stat-lbl">Distance</span></span>
            <span class="stat"><span class="stat-num">{fmtDate(t.date)}</span><span class="stat-lbl">Date</span></span>
          </div>
        </div>
      </a>
      <div class="card-actions">
        <a class="action action-secondary" href={komootUrl(t.id)} target="_blank" rel="noopener noreferrer" onclick={(e) => e.stopPropagation()}>
          Komoot
        </a>
        <button class="action action-primary" onclick={(e) => download(t, e)} disabled={downloading === t.id}>
          {downloading === t.id ? 'Saving…' : 'GPX'}
        </button>
      </div>
    </li>
  {/each}
</ul>

{#if savedModalFilename}
  <SavedModal filename={savedModalFilename} onClose={() => (savedModalFilename = null)} />
{/if}

{#if page + 1 < totalPages}
  <button class="more" onclick={() => loadPage(page + 1)} disabled={loading}>
    {loading ? 'Loading…' : 'Show more'}
  </button>
{/if}

<div id="ad-banner-spacer" style="height: 60px;"></div>

<style>
  .intro { margin-bottom: 2.5rem; max-width: 640px; }
  .lede { color: var(--color-fg-muted); line-height: 1.55; font-size: 1rem; margin: 0.5rem 0 0; max-width: 56ch; }
  .tours { list-style: none; padding: 0; margin: 0;
    display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
  .card { position: relative; background: var(--color-surface); border: 1px solid var(--color-border);
    border-radius: var(--radius); overflow: hidden;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
    animation: fadeUp 0.4s ease both; display: flex; flex-direction: column; }
  .card:hover { border-color: var(--color-border-strong); box-shadow: var(--shadow-md); transform: translateY(-1px); }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  .card-link { display: flex; flex-direction: column; color: inherit; flex: 1; text-decoration: none; }
  .card-map { position: relative; }
  .map-skeleton { width: 100%; aspect-ratio: 320 / 112;
    background: linear-gradient(90deg, transparent 30%, rgba(0,0,0,0.04) 50%, transparent 70%), var(--color-bg-soft);
    background-size: 200% 100%; animation: shimmer 1.6s ease-in-out infinite;
    border-bottom: 1px solid var(--color-border); }
  .map-fallback { width: 100%; aspect-ratio: 320 / 112;
    display: flex; align-items: center; justify-content: center;
    color: var(--color-fg-subtle); font-size: 0.78rem;
    background: var(--color-bg-soft); border-bottom: 1px solid var(--color-border); }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  .card-body { padding: 0.95rem 1.1rem 0.75rem; flex: 1; display: flex; flex-direction: column; }
  .card-meta { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.55rem; }
  .badge { display: inline-flex; align-items: center; height: 20px; padding: 0 0.5rem;
    font-size: 0.7rem; font-weight: 500; border-radius: var(--radius-full);
    background: var(--color-bg-soft); color: var(--color-fg-muted);
    border: 1px solid var(--color-border); }
  .badge-status { background: var(--color-fg); color: var(--color-bg); border-color: var(--color-fg); }
  .badge-public { background: var(--color-bg); color: var(--color-success); border-color: var(--color-success); }
  .badge-light { background: var(--color-bg); }
  .card-title { font-weight: 600; font-size: 1rem; line-height: 1.3; letter-spacing: -0.01em; color: var(--color-fg);
    display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden; margin: 0 0 0.65rem; }
  .card-stats { display: flex; gap: 1.2rem; margin-top: auto;
    padding-top: 0.7rem; border-top: 1px solid var(--color-border); }
  .stat { display: flex; flex-direction: column; gap: 0.05rem; }
  .stat-num { font-size: 0.9rem; font-weight: 600; color: var(--color-fg); }
  .stat-lbl { font-size: 0.7rem; color: var(--color-fg-subtle); font-weight: 500; }
  .card-actions { display: flex; gap: 0.4rem; padding: 0 1.1rem 1rem; }
  .action { display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem;
    height: 32px; padding: 0 0.85rem; font-size: 0.8rem; font-weight: 500;
    border-radius: var(--radius-sm); border: 1px solid transparent;
    transition: background 0.15s, color 0.15s, border-color 0.15s; cursor: pointer; text-decoration: none; }
  .action-primary { background: var(--color-fg); color: var(--color-bg); flex: 1; }
  .action-primary:hover { background: var(--color-accent); }
  .action-primary:disabled { opacity: 0.6; }
  .action-secondary { background: var(--color-bg); color: var(--color-fg-muted); border-color: var(--color-border); }
  .action-secondary:hover { color: var(--color-fg); border-color: var(--color-fg); background: var(--color-bg-soft); }
  .more { display: block; margin: 2.5rem auto 0; padding: 0.65rem 1.4rem;
    background: var(--color-bg); color: var(--color-fg); border: 1px solid var(--color-border);
    border-radius: var(--radius-full); font-size: 0.85rem; font-weight: 500; }
  .error { color: var(--color-error); }
</style>
