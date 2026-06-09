<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getConnectedProviders, getProviderSession, clearProviderSession } from '$lib/client/session';
  import { getActiveProvider, setActiveProvider, activeProvider } from '$lib/client/active-provider';
  import { getProvider } from '$lib/client/providers/registry';
  import type { ProviderId, ActivitySummary } from '$lib/client/provider';
  import { downsample, KomootError, type Coordinate } from '$lib/client/komoot';
  import { StravaError } from '$lib/client/strava';
  import MiniMap from '$lib/client/MiniMap.svelte';
  import SavedModal from '$lib/client/SavedModal.svelte';
  import { saveGpxFile, SaveCancelledError } from '$lib/client/gpx-saver';
  import { showBanner, hideBanner, maybeShowInterstitial } from '$lib/client/ad-banner';
  import { PHASE2 } from '$lib/client/ad-config';
  import { shouldShowShareReminder } from '$lib/client/share-hint';
  import ShareReminderModal from '$lib/client/ShareReminderModal.svelte';
  import { SAVE_COUNT_KEY, maybeRequestReview } from '$lib/client/review';
  import { track, EVENTS } from '$lib/client/analytics';

  let savedModalFilename = $state<string | null>(null);
  let showShareReminder = $state(false);

  let activeProviderId = $state<ProviderId>('komoot');
  let connected = $state<ProviderId[]>([]);
  let tours = $state<ActivitySummary[]>([]);
  let page = $state(0);
  let totalPages = $state(1);
  let loading = $state(false);
  let errorMsg = $state<string | null>(null);
  let downloading = $state<string | null>(null);
  let shapes = $state<Record<string, Coordinate[] | 'loading' | 'error'>>({});
  let filter = $state<string>('all');
  let bootstrapped = $state(false); // false until the active source is reconciled (avoids a wrong-provider flash)

  const provider = $derived(getProvider(activeProviderId));

  function isAuthError(e: unknown): boolean {
    return (e instanceof KomootError && e.status === 401) || (e instanceof StravaError && e.status === 401);
  }

  async function onAuthFail() {
    await clearProviderSession(activeProviderId);
    connected = await getConnectedProviders();
    if (connected.length === 0) {
      await goto('/login', { replaceState: true });
      return;
    }
    setActiveProvider(connected[0]); // the store effect reloads the list
  }

  function resetList() {
    tours = [];
    shapes = {};
    page = 0;
    totalPages = 1;
  }

  function applyActiveProvider(id: ProviderId) {
    activeProviderId = id;
    filter = getProvider(id).capabilities.filters[0]?.id ?? 'all';
    resetList();
    void loadPage(0);
  }

  function setFilter(f: string) {
    if (f === filter) return;
    filter = f;
    void track(EVENTS.FILTER_CHANGE, { provider: activeProviderId, filter: f });
    resetList();
    void loadPage(0);
  }

  async function loadPage(p: number) {
    const s = await getProviderSession(activeProviderId);
    if (!s) { await onAuthFail(); return; }
    loading = true;
    errorMsg = null;
    try {
      const data = await provider.listActivities(s, { page: p, filter });
      tours = p === 0 ? data.items : [...tours, ...data.items];
      totalPages = data.totalPages;
      page = data.page;
    } catch (e) {
      if (isAuthError(e)) { await onAuthFail(); return; }
      errorMsg = 'Failed to load activities.';
    } finally {
      loading = false;
    }
  }

  async function loadShape(id: string) {
    if (shapes[id]) return;
    const s = await getProviderSession(activeProviderId);
    if (!s) return;
    shapes = { ...shapes, [id]: 'loading' };
    try {
      const detail = await provider.getActivity(s, id);
      shapes = { ...shapes, [id]: downsample(detail.preview, 160) };
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
    return name.replace(/[^\p{L}\p{N}\-_ ]+/gu, '').trim().replace(/\s+/g, '_') || 'tour';
  }

  async function download(t: ActivitySummary, e: MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const s = await getProviderSession(activeProviderId);
    if (!s) { await onAuthFail(); return; }
    downloading = t.id;
    errorMsg = null;
    try {
      const xml = await provider.getGpx(s, t.id);
      const filename = safeName(t.name) + '.gpx';
      await saveGpxFile(filename, xml);
      const count = Number(localStorage.getItem(SAVE_COUNT_KEY) ?? '0') + 1;
      localStorage.setItem(SAVE_COUNT_KEY, String(count));
      if (count % PHASE2.INTERSTITIAL_EVERY_NTH_SAVE === 0) {
        void maybeShowInterstitial();
      }
      savedModalFilename = filename;
      void track(EVENTS.EXPORT_SUCCESS, { provider: activeProviderId, source: 'list' });
    } catch (err) {
      if (err instanceof SaveCancelledError) { errorMsg = null; return; }
      if (isAuthError(err)) {
        void track(EVENTS.EXPORT_FAIL, { provider: activeProviderId, reason: 'auth' });
        await onAuthFail();
        return;
      }
      void track(EVENTS.EXPORT_FAIL, { provider: activeProviderId, reason: 'api' });
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
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—'
      : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtDist(m: number): string { return (m / 1000).toFixed(1) + ' km'; }
  function fmtSport(s: string): string { return sportLabel[s] ?? s.replace(/_/g, ' '); }
  function activityUrl(id: string): string {
    if (activeProviderId !== 'strava') return `https://www.komoot.com/tour/${id}`;
    const raw = id.replace(/^(activity|route)-/, '');
    return id.startsWith('route-')
      ? `https://www.strava.com/routes/${raw}`
      : `https://www.strava.com/activities/${raw}`;
  }

  onMount(() => {
    void showBanner();
    return () => { void hideBanner(); };
  });

  $effect(() => {
    const id = $activeProvider;
    void (async () => {
      connected = await getConnectedProviders();
      let active = id;
      if (connected.length > 0 && !connected.includes(active)) {
        active = connected[0];
        setActiveProvider(active); // re-enters this effect with the corrected id
        return;
      }
      if (bootstrapped && active === activeProviderId) return; // already showing it
      applyActiveProvider(active);
      showShareReminder = active === 'komoot' && shouldShowShareReminder();
      bootstrapped = true;
    })();
  });
</script>

<section class="intro">
  <h1>Your activities.</h1>
  <p class="lede">Every recorded route from your account — ready to download as GPX.</p>
</section>

{#if bootstrapped}
{#if activeProviderId === 'komoot'}
  <aside class="hint">
    <svg class="hint-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="12" r="2.6" stroke="currentColor" stroke-width="1.8" />
      <circle cx="17" cy="5.5" r="2.6" stroke="currentColor" stroke-width="1.8" />
      <circle cx="17" cy="18.5" r="2.6" stroke="currentColor" stroke-width="1.8" />
      <path d="M8.3 10.8 L14.7 6.9 M8.3 13.2 L14.7 17.1" stroke="currentColor" stroke-width="1.8" />
    </svg>
    <p class="hint-text">
      <strong>Tip:</strong> in the Komoot app, open any tour and tap
      <strong>Share</strong> → <strong>Export GPX</strong> — it opens right here, ready to save.
    </p>
  </aside>
{/if}

{#if provider.capabilities.filters.length > 1}
  <div class="filters" role="tablist" aria-label="Filter">
    {#each provider.capabilities.filters as f (f.id)}
      <button class="chip" role="tab" aria-selected={filter === f.id} class:active={filter === f.id}
        onclick={() => setFilter(f.id)}>{f.label}</button>
    {/each}
  </div>
{/if}

{#if errorMsg}<p class="error">{errorMsg}</p>{/if}

{#if !loading && tours.length === 0}
  <p class="empty">No activities in this view.</p>
{/if}

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
            {#if t.status}
              <span class="badge badge-status" class:badge-public={t.status === 'public'}>
                {t.status === 'public' ? 'Public' : 'Private'}
              </span>
            {/if}
            <span class="badge badge-light">{t.kind === 'planned' ? 'Planned' : 'Completed'}</span>
          </div>
          <strong class="card-title">{t.name}</strong>
          <div class="card-stats">
            <span class="stat"><span class="stat-num">{fmtDist(t.distance)}</span><span class="stat-lbl">Distance</span></span>
            <span class="stat"><span class="stat-num">{fmtDate(t.date)}</span><span class="stat-lbl">Date</span></span>
          </div>
        </div>
      </a>
      <div class="card-actions">
        <a class="action action-secondary" href={activityUrl(t.id)} target="_blank" rel="noopener noreferrer" onclick={(e) => e.stopPropagation()}>
          {provider.label}
        </a>
        <button class="action action-primary" onclick={(e) => download(t, e)} disabled={downloading === t.id}>
          {downloading === t.id ? 'Saving…' : 'GPX'}
        </button>
      </div>
    </li>
  {/each}
</ul>
{:else}
  <p class="empty">Loading…</p>
{/if}

{#if savedModalFilename}
  <SavedModal
    filename={savedModalFilename}
    onClose={() => {
      savedModalFilename = null;
      void maybeRequestReview();
    }}
  />
{/if}

{#if showShareReminder}
  <ShareReminderModal onClose={() => (showShareReminder = false)} />
{/if}

{#if page + 1 < totalPages}
  <button class="more" onclick={() => loadPage(page + 1)} disabled={loading}>
    {loading ? 'Loading…' : 'Show more'}
  </button>
{/if}

{#if tours.length > 0}
  <p class="attribution">
    Map data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors
  </p>
{/if}

{#if bootstrapped && activeProviderId === 'strava'}
  <p class="powered">Powered by Strava</p>
{/if}

<div id="ad-banner-spacer" style="height: 60px;"></div>

<style>
  .intro { margin-bottom: 2.5rem; max-width: 640px; }
  .lede { color: var(--color-fg-muted); line-height: 1.55; font-size: 1rem; margin: 0.5rem 0 0; max-width: 56ch; }

  .powered { margin: 1.5rem 0 0; text-align: center; font-size: 0.7rem; color: var(--color-fg-subtle);
    letter-spacing: 0.04em; text-transform: uppercase; }

  .hint {
    display: flex; align-items: flex-start; gap: 0.65rem;
    max-width: 640px;
    margin: 0 0 1.75rem;
    padding: 0.8rem 0.9rem;
    background: var(--color-bg-soft);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }
  .hint-icon { flex-shrink: 0; margin-top: 0.1rem; color: var(--color-fg-muted); }
  .hint-text {
    margin: 0; font-size: 0.85rem; line-height: 1.5;
    color: var(--color-fg-muted);
  }
  .hint-text strong { color: var(--color-fg); font-weight: 600; }
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
  .attribution { margin-top: 1.75rem; font-size: 0.7rem; color: var(--color-fg-subtle); text-align: center; }
  .attribution a { color: inherit; }
  .filters { display: flex; gap: 0.4rem; margin: 0 0 1.5rem; flex-wrap: wrap; }
  .chip { display: inline-flex; align-items: center; height: 32px; padding: 0 0.95rem;
    font-size: 0.82rem; font-weight: 500; border-radius: var(--radius-full);
    background: var(--color-bg); color: var(--color-fg-muted);
    border: 1px solid var(--color-border); cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s; }
  .chip:hover { color: var(--color-fg); border-color: var(--color-fg); }
  .chip.active { background: var(--color-fg); color: var(--color-bg); border-color: var(--color-fg); }
  .empty { color: var(--color-fg-subtle); text-align: center; padding: 2rem 0; }
</style>
