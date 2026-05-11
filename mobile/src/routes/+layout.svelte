<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { getSession, clearSession } from '$lib/client/session';
  import { initAds } from '$lib/client/ad-banner';
  import '../app.css';

  let { children } = $props();

  let ready = $state(false);
  let userLabel = $state<string | null>(null);

  onMount(async () => {
    void initAds();
    const s = await getSession();
    const path = $page.url.pathname;
    if (!s && path !== '/login') {
      goto('/login', { replaceState: true });
      return;
    }
    if (s && path === '/login') {
      goto('/', { replaceState: true });
      return;
    }
    userLabel = s?.email ?? null;
    ready = true;
  });

  async function signOut() {
    await clearSession();
    userLabel = null;
    goto('/login', { replaceState: true });
  }
</script>

<header class="app-header">
  <div class="app-header-inner">
    <a class="brand" href="/">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M2 16 L6 6 L10 12 L14 7 L18 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span>Export GPX</span>
    </a>
    <nav class="nav">
      <a class="nav-link" href="https://www.komoot.com" target="_blank" rel="noopener noreferrer">
        Komoot
      </a>
      {#if userLabel}
        <span class="user">{userLabel}</span>
        <button class="logout" onclick={signOut}>Sign out</button>
      {/if}
    </nav>
  </div>
</header>

{#if ready}
  <main>
    {@render children()}
  </main>
{/if}

<style>
  .app-header {
    border-bottom: 1px solid var(--color-border);
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    position: sticky; top: 0; z-index: 10;
  }
  .app-header-inner {
    max-width: 1100px; margin: 0 auto;
    padding: 0.85rem 1.25rem;
    display: flex; align-items: center; gap: 1rem;
  }
  .brand {
    display: inline-flex; align-items: center; gap: 0.5rem;
    font-weight: 600; font-size: 0.95rem; color: var(--color-fg);
  }
  .nav { margin-left: auto; display: flex; align-items: center; gap: 0.75rem; }
  .nav-link {
    font-size: 0.85rem; color: var(--color-fg-muted);
    padding: 0.4rem 0.7rem; border-radius: var(--radius-sm);
    transition: color 0.15s, background 0.15s;
  }
  .nav-link:hover { color: var(--color-fg); background: var(--color-bg-soft); }
  .user {
    color: var(--color-fg-muted); font-size: 0.85rem;
    max-width: 22ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    padding-left: 0.75rem; border-left: 1px solid var(--color-border);
  }
  .logout {
    background: transparent; color: var(--color-fg-muted);
    border: 1px solid var(--color-border); border-radius: var(--radius-full);
    padding: 0.35rem 0.85rem; font-size: 0.82rem;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .logout:hover { border-color: var(--color-fg); color: var(--color-fg); background: var(--color-bg-soft); }
  main { max-width: 1100px; margin: 0 auto; padding: 1.5rem 1.25rem 4rem; }
  @media (max-width: 560px) { .user { display: none; } }
</style>
