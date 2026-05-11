<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { getSession, clearSession } from '$lib/client/session';
  import '../app.css';

  let { children } = $props();

  let ready = $state(false);
  let email = $state<string | null>(null);

  onMount(() => {
    const s = getSession();
    const path = $page.url.pathname;
    if (!s && path !== '/login') {
      goto('/login', { replaceState: true });
      return;
    }
    if (s && path === '/login') {
      goto('/', { replaceState: true });
      return;
    }
    email = s?.email ?? null;
    ready = true;
  });

  function logout() {
    clearSession();
    email = null;
    goto('/login', { replaceState: true });
  }
</script>

<header class="app-header">
  <div class="app-header-inner">
    <a class="brand" href="/">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M2 16 L6 6 L10 12 L14 7 L18 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span>Komoot&nbsp;<span class="arr">→</span>&nbsp;GPX</span>
    </a>
    <nav class="nav">
      <a class="nav-link" href="https://www.komoot.com" target="_blank" rel="noopener noreferrer">
        Komoot
        <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M4 2h6v6M10 2L4 8M2 5v5h5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </a>
      {#if email}
        <span class="user">{email}</span>
        <button class="logout" onclick={logout}>Sign out</button>
      {/if}
    </nav>
  </div>
</header>

{#if ready}
  <main>
    {@render children()}
  </main>
{/if}

<footer class="app-footer">
  <div class="app-footer-inner">
    <span>Komoot → GPX</span>
    <span class="dot">·</span>
    <span>Export your private routes</span>
    <span class="dot">·</span>
    <span>Maps © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a></span>
  </div>
</footer>

<style>
  .app-header {
    border-bottom: 1px solid var(--color-border);
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .app-header-inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0.85rem 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    font-size: 0.95rem;
    letter-spacing: -0.01em;
    color: var(--color-fg);
  }
  .arr { color: var(--color-fg-subtle); font-weight: 400; }

  .nav {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .nav-link {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.4rem 0.7rem;
    font-size: 0.85rem;
    color: var(--color-fg-muted);
    border-radius: var(--radius-sm);
    transition: color 0.15s, background 0.15s;
  }
  .nav-link:hover {
    color: var(--color-fg);
    background: var(--color-bg-soft);
  }
  .user {
    color: var(--color-fg-muted);
    font-size: 0.85rem;
    max-width: 22ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-left: 0.75rem;
    border-left: 1px solid var(--color-border);
  }
  .logout {
    background: transparent;
    color: var(--color-fg-muted);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    padding: 0.35rem 0.85rem;
    font-size: 0.82rem;
    font-weight: 500;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .logout:hover {
    border-color: var(--color-fg);
    color: var(--color-fg);
    background: var(--color-bg-soft);
  }

  main {
    max-width: 1100px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 4rem;
  }

  .app-footer {
    border-top: 1px solid var(--color-border);
    background: var(--color-bg);
  }
  .app-footer-inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 1.5rem 1.5rem 2rem;
    color: var(--color-fg-subtle);
    font-size: 0.78rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    align-items: center;
  }
  .app-footer a { color: var(--color-fg-muted); text-decoration: underline; text-decoration-color: var(--color-border-strong); text-underline-offset: 2px; }
  .app-footer a:hover { color: var(--color-fg); }
  .dot { color: var(--color-border-strong); }

  @media (max-width: 560px) {
    .user { display: none; }
    .app-header-inner { padding: 0.75rem 1rem; }
    main { padding: 1.5rem 1rem 3rem; }
  }
</style>
