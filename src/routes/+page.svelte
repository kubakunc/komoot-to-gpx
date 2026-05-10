<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authHeader, clearSession, getSession } from '$lib/client/session';

  interface TourSummary {
    id: string;
    name: string;
    sport: string;
    distance: number;
    date: string;
    status: string;
    type: string;
  }

  let tours = $state<TourSummary[]>([]);
  let page = $state(0);
  let totalPages = $state(1);
  let loading = $state(false);
  let errorMsg = $state<string | null>(null);
  let downloading = $state<string | null>(null);

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

  function safeName(name: string): string {
    return (
      name
        .replace(/[^\p{L}\p{N}\-_ ]+/gu, '')
        .trim()
        .replace(/\s+/g, '_') || 'tour'
    );
  }

  async function download(t: TourSummary) {
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

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function fmtDist(m: number): string {
    return (m / 1000).toFixed(1) + ' km';
  }

  onMount(() => loadPage(0));
</script>

<h1>Twoje trasy</h1>

{#if errorMsg}<p class="error">{errorMsg}</p>{/if}

{#if tours.length === 0 && !loading}
  <p>Brak tras.</p>
{/if}

<ul class="tours">
  {#each tours as t (t.id)}
    <li>
      <div class="meta">
        <strong>{t.name}</strong>
        <span class="sub">{fmtDate(t.date)} · {fmtDist(t.distance)} · {t.sport} · {t.status}</span>
      </div>
      <button onclick={() => download(t)} disabled={downloading === t.id}>
        {downloading === t.id ? 'pobieram…' : 'GPX'}
      </button>
    </li>
  {/each}
</ul>

{#if page + 1 < totalPages}
  <button class="more" onclick={() => loadPage(page + 1)} disabled={loading}>
    {loading ? 'ładuję…' : 'wczytaj więcej'}
  </button>
{/if}

<style>
  .tours { list-style: none; padding: 0; display: grid; gap: 0.5rem; }
  .tours li {
    display: flex; align-items: center; gap: 1rem;
    padding: 0.75rem 1rem;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 6px;
  }
  .meta { flex: 1; min-width: 0; }
  .sub { display: block; color: #666; font-size: 0.85rem; }
  .more { margin-top: 1rem; padding: 0.6rem 1rem; }
  button { padding: 0.4rem 0.8rem; background: var(--color-accent); color: white; border: 0; border-radius: 4px; }
  button:disabled { opacity: 0.5; }
  .error { color: var(--color-error); }
</style>
