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
  <span class="brand">komoot → GPX</span>
  {#if email}
    <span class="user">{email}</span>
    <button onclick={logout}>wyloguj</button>
  {/if}
</header>

{#if ready}
  <main>
    {@render children()}
  </main>
{/if}

<style>
  .app-header {
    display: flex;
    gap: 1rem;
    align-items: center;
    padding: 0.75rem 1rem;
    background: white;
    border-bottom: 1px solid var(--color-border);
  }
  .brand { font-weight: 600; }
  .user { margin-left: auto; color: #666; font-size: 0.9rem; }
  main { max-width: 800px; margin: 0 auto; padding: 1rem; }
</style>
