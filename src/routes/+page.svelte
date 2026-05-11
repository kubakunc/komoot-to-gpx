<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authHeader, clearSession, getSession } from '$lib/client/session';
  import MiniMap from '$lib/client/MiniMap.svelte';

  interface TourSummary {
    id: string;
    name: string;
    sport: string;
    distance: number;
    date: string;
    status: string;
    type: string;
  }
  interface Coord { lat: number; lng: number }

  let tours = $state<TourSummary[]>([]);
  let page = $state(0);
  let totalPages = $state(1);
  let loading = $state(false);
  let errorMsg = $state<string | null>(null);
  let downloading = $state<string | null>(null);
  let shapes = $state<Record<string, Coord[] | 'loading' | 'error'>>({});

  async function loadPage(p: number) {
    const s = getSession();
    if (!s) return;
    loading = true;
    errorMsg = null;
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
        errorMsg = 'Failed to load tours.';
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

  async function loadShape(id: string) {
    if (shapes[id]) return;
    const s = getSession();
    if (!s) return;
    shapes = { ...shapes, [id]: 'loading' };
    try {
      const res = await fetch(`/api/tours/${id}/shape`, {
        headers: { authorization: authHeader(s) }
      });
      if (!res.ok) {
        shapes = { ...shapes, [id]: 'error' };
        return;
      }
      const data = (await res.json()) as { coords: Coord[] };
      shapes = { ...shapes, [id]: data.coords };
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
    return {
      destroy() {
        io.disconnect();
      }
    };
  }

  function safeName(name: string): string {
    return (
      name
        .replace(/[^\p{L}\p{N}\-_ ]+/gu, '')
        .trim()
        .replace(/\s+/g, '_') || 'tour'
    );
  }

  async function download(t: TourSummary, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const s = getSession();
    if (!s) return;
    downloading = t.id;
    errorMsg = null;
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
        errorMsg = 'Download failed.';
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName(t.name)}.gpx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      downloading = null;
    }
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

  function fmtDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtDist(m: number): string {
    return (m / 1000).toFixed(1) + ' km';
  }

  function fmtSport(s: string): string {
    return sportLabel[s] ?? s.replace(/_/g, ' ');
  }

  const komootUrl = (id: string) => `https://www.komoot.com/tour/${id}`;

  onMount(() => loadPage(0));
</script>

<section class="intro">
  <h1>Your tours.</h1>
  <p class="lede">
    Every recorded and planned route from your Komoot account &mdash; ready to download as
    GPX for your watch, bike computer, or any other app.
  </p>
</section>

{#if errorMsg}<p class="error">{errorMsg}</p>{/if}

{#if tours.length === 0 && !loading}
  <p class="empty">No tours yet.</p>
{/if}

<ul class="tours">
  {#each tours as t, i (t.id)}
    <li class="card" style="animation-delay: {Math.min(i, 8) * 30}ms" use:observeCard={t.id}>
      <a class="card-link" href={`/tour/${t.id}`} aria-label={`Open ${t.name}`}>
        <div class="card-map">
          {#if shapes[t.id] && shapes[t.id] !== 'loading' && shapes[t.id] !== 'error'}
            <MiniMap coords={shapes[t.id] as Coord[]} />
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
            <span class="stat">
              <span class="stat-num">{fmtDist(t.distance)}</span>
              <span class="stat-lbl">Distance</span>
            </span>
            <span class="stat">
              <span class="stat-num">{fmtDate(t.date)}</span>
              <span class="stat-lbl">Date</span>
            </span>
          </div>
        </div>
      </a>
      <div class="card-actions">
        <a
          class="action action-secondary"
          href={komootUrl(t.id)}
          target="_blank"
          rel="noopener noreferrer"
          onclick={(e) => e.stopPropagation()}
          aria-label="Open in Komoot"
          title="Open in Komoot"
        >
          <svg width="13" height="13" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4">
            <path d="M4 2h6v6M10 2L4 8M2 5v5h5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Komoot
        </a>
        <button class="action action-primary" onclick={(e) => download(t, e)} disabled={downloading === t.id}>
          {#if downloading === t.id}
            <span class="spinner" aria-hidden="true"></span>
            Downloading
          {:else}
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M8 2v9m0 0l-3-3m3 3l3-3M3 14h10" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            GPX
          {/if}
        </button>
      </div>
    </li>
  {/each}
</ul>

{#if loading && tours.length === 0}
  <p class="loading-msg">Loading tours…</p>
{/if}

{#if page + 1 < totalPages}
  <button class="more" onclick={() => loadPage(page + 1)} disabled={loading}>
    {loading ? 'Loading…' : 'Show more'}
  </button>
{/if}

<style>
  .intro {
    margin-bottom: 2.5rem;
    max-width: 640px;
  }
  .lede {
    color: var(--color-fg-muted);
    line-height: 1.55;
    font-size: 1rem;
    margin: 0.5rem 0 0;
    max-width: 56ch;
  }

  .tours {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.25rem;
  }

  .card {
    position: relative;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    overflow: hidden;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
    animation: fadeUp 0.4s ease both;
    display: flex;
    flex-direction: column;
  }
  .card:hover {
    border-color: var(--color-border-strong);
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .card-link {
    display: flex;
    flex-direction: column;
    color: inherit;
    flex: 1;
  }

  .card-map { position: relative; }
  .map-skeleton {
    width: 100%;
    aspect-ratio: 320 / 112;
    background:
      linear-gradient(90deg, transparent 30%, rgba(0, 0, 0, 0.04) 50%, transparent 70%),
      var(--color-bg-soft);
    background-size: 200% 100%;
    animation: shimmer 1.6s ease-in-out infinite;
    border-bottom: 1px solid var(--color-border);
  }
  .map-fallback {
    width: 100%;
    aspect-ratio: 320 / 112;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-fg-subtle);
    font-size: 0.78rem;
    background: var(--color-bg-soft);
    border-bottom: 1px solid var(--color-border);
  }
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .card-body {
    padding: 0.95rem 1.1rem 0.75rem;
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-bottom: 0.55rem;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 0.5rem;
    font-size: 0.7rem;
    font-weight: 500;
    border-radius: var(--radius-full);
    background: var(--color-bg-soft);
    color: var(--color-fg-muted);
    border: 1px solid var(--color-border);
    letter-spacing: 0.01em;
  }
  .badge-status {
    background: var(--color-fg);
    color: var(--color-bg);
    border-color: var(--color-fg);
  }
  .badge-public {
    background: var(--color-bg);
    color: var(--color-success);
    border-color: var(--color-success);
  }
  .badge-light {
    background: var(--color-bg);
  }
  .card-title {
    font-weight: 600;
    font-size: 1rem;
    line-height: 1.3;
    letter-spacing: -0.01em;
    color: var(--color-fg);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin: 0 0 0.65rem;
  }
  .card-stats {
    display: flex;
    gap: 1.2rem;
    margin-top: auto;
    padding-top: 0.7rem;
    border-top: 1px solid var(--color-border);
  }
  .stat { display: flex; flex-direction: column; gap: 0.05rem; }
  .stat-num {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-fg);
    letter-spacing: -0.01em;
  }
  .stat-lbl {
    font-size: 0.7rem;
    color: var(--color-fg-subtle);
    font-weight: 500;
  }

  .card-actions {
    display: flex;
    gap: 0.4rem;
    padding: 0 1.1rem 1rem;
  }

  .action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    height: 32px;
    padding: 0 0.85rem;
    font-size: 0.8rem;
    font-weight: 500;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.15s;
    cursor: pointer;
  }
  .action-primary {
    background: var(--color-fg);
    color: var(--color-bg);
    flex: 1;
  }
  .action-primary:hover { background: var(--color-accent); }
  .action-primary:active { transform: scale(0.98); }
  .action-primary:disabled { opacity: 0.6; cursor: progress; }
  .action-secondary {
    background: var(--color-bg);
    color: var(--color-fg-muted);
    border-color: var(--color-border);
  }
  .action-secondary:hover {
    color: var(--color-fg);
    border-color: var(--color-fg);
    background: var(--color-bg-soft);
  }

  .spinner {
    width: 10px; height: 10px;
    border: 1.5px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .more {
    display: block;
    margin: 2.5rem auto 0;
    padding: 0.65rem 1.4rem;
    background: var(--color-bg);
    color: var(--color-fg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    font-size: 0.85rem;
    font-weight: 500;
    transition: background 0.15s, border-color 0.15s;
  }
  .more:hover {
    background: var(--color-bg-soft);
    border-color: var(--color-border-strong);
  }

  .error { color: var(--color-error); }
  .empty, .loading-msg {
    text-align: center;
    color: var(--color-fg-subtle);
    margin: 3rem 0;
  }
</style>
