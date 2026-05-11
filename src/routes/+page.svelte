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
        errorMsg = 'Nie udało się załadować tras.';
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
        errorMsg = 'Pobieranie nie powiodło się.';
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
    racebike: 'szosa',
    touringbicycle: 'gravel',
    mtb: 'MTB',
    hike: 'pieszo',
    jogging: 'bieg',
    e_racebike: 'e-szosa',
    e_mtb: 'e-MTB',
    e_touringbicycle: 'e-trekking'
  };

  function fmtDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function fmtDist(m: number): string {
    return (m / 1000).toFixed(1) + ' km';
  }

  function fmtSport(s: string): string {
    return sportLabel[s] ?? s.replace(/_/g, ' ');
  }

  onMount(() => loadPage(0));
</script>

<section class="intro">
  <span class="kicker">archiwum tras</span>
  <h1>Twój dziennik wypraw.</h1>
  <p class="lede">
    Wszystkie zapisane i zaplanowane trasy z Twojego konta Komoot —
    gotowe do pobrania jako pliki GPX dla Twojego zegarka, komputera rowerowego lub innej aplikacji.
  </p>
</section>

{#if errorMsg}<p class="error">{errorMsg}</p>{/if}

{#if tours.length === 0 && !loading}
  <p class="empty">— Brak tras. —</p>
{/if}

<ul class="tours">
  {#each tours as t, i (t.id)}
    <li class="card" style="animation-delay: {Math.min(i, 8) * 35}ms" use:observeCard={t.id}>
      <a class="card-link" href={`/tour/${t.id}`} aria-label={`Otwórz: ${t.name}`}>
        <div class="card-map">
          {#if shapes[t.id] && shapes[t.id] !== 'loading' && shapes[t.id] !== 'error'}
            <MiniMap coords={shapes[t.id] as Coord[]} />
          {:else if shapes[t.id] === 'error'}
            <div class="map-fallback">trasa niedostępna</div>
          {:else}
            <div class="map-skeleton" aria-hidden="true"></div>
          {/if}
          <span class="status-pill" class:public={t.status === 'public'}>{t.status === 'public' ? 'publiczna' : 'prywatna'}</span>
        </div>
        <div class="card-body">
          <span class="card-eyebrow">{fmtSport(t.sport)} · {t.type === 'tour_planned' ? 'plan' : 'przejechana'}</span>
          <strong class="card-title">{t.name}</strong>
          <div class="card-stats">
            <span class="stat">
              <span class="stat-num">{fmtDist(t.distance)}</span>
              <span class="stat-lbl">dystans</span>
            </span>
            <span class="stat">
              <span class="stat-num">{fmtDate(t.date)}</span>
              <span class="stat-lbl">data</span>
            </span>
          </div>
        </div>
      </a>
      <button class="gpx-btn" onclick={(e) => download(t, e)} disabled={downloading === t.id}>
        {#if downloading === t.id}
          <span class="spinner" aria-hidden="true"></span>
          pobieram
        {:else}
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M8 2v9m0 0l-3-3m3 3l3-3M3 14h10" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          GPX
        {/if}
      </button>
    </li>
  {/each}
</ul>

{#if loading && tours.length === 0}
  <p class="loading-msg">— Pobieram listę… —</p>
{/if}

{#if page + 1 < totalPages}
  <button class="more" onclick={() => loadPage(page + 1)} disabled={loading}>
    {loading ? 'ładuję…' : 'pokaż starsze trasy'}
  </button>
{/if}

<style>
  .intro {
    margin-bottom: 2.5rem;
    max-width: 640px;
  }
  .kicker {
    display: inline-block;
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-terra);
    font-weight: 600;
    margin-bottom: 0.4rem;
  }
  .lede {
    color: var(--color-ink-soft);
    line-height: 1.55;
    font-size: 1.02rem;
    margin: 0.6rem 0 0;
    max-width: 50ch;
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
    background: var(--color-paper);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    overflow: hidden;
    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    animation: fadeUp 0.5s ease both;
    box-shadow: 0 1px 0 rgba(28, 33, 26, 0.04);
  }
  .card:hover {
    transform: translateY(-2px);
    border-color: var(--border-strong);
    box-shadow: 0 12px 28px -16px rgba(28, 33, 26, 0.3);
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .card-link {
    display: block;
    text-decoration: none;
    color: inherit;
  }

  .card-map {
    position: relative;
    background: var(--color-paper-warm);
    border-bottom: 1px solid var(--border-subtle);
  }
  .map-skeleton {
    width: 100%;
    aspect-ratio: 320 / 96;
    background:
      linear-gradient(120deg, transparent 30%, rgba(28, 33, 26, 0.05) 50%, transparent 70%),
      var(--color-paper-warm);
    background-size: 200% 100%;
    animation: shimmer 1.6s ease-in-out infinite;
  }
  .map-fallback {
    width: 100%;
    aspect-ratio: 320 / 96;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-sage);
    font-size: 0.78rem;
    letter-spacing: 0.06em;
    text-transform: lowercase;
    background: var(--color-paper-warm);
  }
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .status-pill {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(244, 238, 224, 0.94);
    color: var(--color-terra-deep);
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 600;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    border: 1px solid var(--border-subtle);
    backdrop-filter: blur(2px);
  }
  .status-pill.public {
    color: var(--color-forest);
  }

  .card-body {
    padding: 0.9rem 1rem 1.05rem;
  }
  .card-eyebrow {
    display: block;
    font-size: 0.7rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-sage);
    margin-bottom: 0.35rem;
    font-weight: 500;
  }
  .card-title {
    font-family: var(--font-display);
    font-weight: 500;
    font-size: 1.15rem;
    line-height: 1.25;
    letter-spacing: -0.005em;
    color: var(--color-ink);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin: 0;
    font-variation-settings: 'opsz' 144, 'SOFT' 30;
  }
  .card-stats {
    display: flex;
    gap: 1.2rem;
    margin-top: 0.7rem;
    padding-top: 0.7rem;
    border-top: 1px dashed var(--border-subtle);
  }
  .stat { display: flex; flex-direction: column; gap: 0.1rem; }
  .stat-num {
    font-family: var(--font-display);
    font-size: 0.95rem;
    color: var(--color-ink);
    font-variation-settings: 'opsz' 36;
  }
  .stat-lbl {
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-sage);
  }

  .gpx-btn {
    position: absolute;
    bottom: 0.9rem;
    right: 1rem;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: var(--color-ink);
    color: var(--color-paper);
    border: 0;
    border-radius: 999px;
    padding: 0.4rem 0.85rem;
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 600;
    transition: background 0.15s, transform 0.15s;
  }
  .gpx-btn:hover { background: var(--color-terra); }
  .gpx-btn:active { transform: scale(0.96); }
  .gpx-btn:disabled { opacity: 0.6; cursor: progress; }

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
    padding: 0.7rem 1.6rem;
    background: transparent;
    color: var(--color-ink);
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    font-size: 0.85rem;
    letter-spacing: 0.06em;
    transition: background 0.15s, color 0.15s;
  }
  .more:hover { background: var(--color-ink); color: var(--color-paper); }

  .error { color: var(--color-error); }
  .empty, .loading-msg {
    text-align: center;
    color: var(--color-sage);
    letter-spacing: 0.06em;
    margin: 3rem 0;
  }
</style>
