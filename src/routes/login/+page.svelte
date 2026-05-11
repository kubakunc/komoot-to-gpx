<script lang="ts">
  import { goto } from '$app/navigation';
  import { setSession } from '$lib/client/session';

  let email = $state('');
  let password = $state('');
  let errorMsg = $state<string | null>(null);
  let busy = $state(false);

  async function submit(e: Event) {
    e.preventDefault();
    errorMsg = null;
    busy = true;
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.status === 401) {
        errorMsg = 'Invalid email or password.';
        return;
      }
      if (res.status === 429) {
        errorMsg = 'Too many attempts. Try again shortly.';
        return;
      }
      if (!res.ok) {
        errorMsg = 'Komoot is not responding. Please try again.';
        return;
      }
      const data = (await res.json()) as { userId: string; token: string };
      setSession({ email, userId: data.userId, token: data.token });
      await goto('/', { replaceState: true });
    } catch {
      errorMsg = 'Network error.';
    } finally {
      busy = false;
    }
  }
</script>

<section class="auth">
  <h1>Sign in with Komoot.</h1>
  <p class="lede">
    Your password is held only in server memory for one request — we exchange it immediately
    for a Komoot access token. We use that token to fetch your tours.
  </p>

  <form onsubmit={submit}>
    <label>
      <span class="lbl">Email</span>
      <input type="email" bind:value={email} required autocomplete="username" placeholder="you@example.com" />
    </label>
    <label>
      <span class="lbl">Password</span>
      <input type="password" bind:value={password} required autocomplete="current-password" placeholder="••••••••" />
    </label>
    {#if errorMsg}<p class="error">{errorMsg}</p>{/if}
    <button type="submit" disabled={busy}>
      {#if busy}
        <span class="spinner" aria-hidden="true"></span>
        Signing in…
      {:else}
        Sign in
      {/if}
    </button>
  </form>

  <p class="footnote">
    Don't have a Komoot account?
    <a href="https://www.komoot.com" target="_blank" rel="noopener noreferrer">
      Get one at komoot.com
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4">
        <path d="M4 2h6v6M10 2L4 8M2 5v5h5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </a>
  </p>
</section>

<style>
  .auth {
    max-width: 380px;
    margin: 3rem auto 0;
  }
  .lede {
    color: var(--color-fg-muted);
    line-height: 1.55;
    font-size: 0.95rem;
    margin: 0.5rem 0 2rem;
  }

  form { display: grid; gap: 1rem; }

  .lbl {
    display: block;
    font-size: 0.82rem;
    color: var(--color-fg);
    margin-bottom: 0.35rem;
    font-weight: 500;
  }
  label { display: block; }

  input {
    width: 100%;
    height: 40px;
    padding: 0 0.85rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-bg);
    font: inherit;
    font-size: 0.95rem;
    color: var(--color-fg);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  input::placeholder { color: var(--color-fg-subtle); }
  input:focus {
    outline: none;
    border-color: var(--color-fg);
    box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.04);
  }

  button[type="submit"] {
    margin-top: 0.4rem;
    height: 40px;
    padding: 0 1.1rem;
    background: var(--color-fg);
    color: var(--color-bg);
    border: 0;
    border-radius: var(--radius-sm);
    font-size: 0.95rem;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: background 0.15s, transform 0.15s;
  }
  button[type="submit"]:hover { background: var(--color-accent); }
  button[type="submit"]:active { transform: scale(0.99); }
  button[type="submit"]:disabled { opacity: 0.65; cursor: progress; }

  .spinner {
    width: 12px; height: 12px;
    border: 1.5px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .error { color: var(--color-error); margin: 0; font-size: 0.88rem; }

  .footnote {
    margin-top: 1.5rem;
    color: var(--color-fg-subtle);
    font-size: 0.85rem;
  }
  .footnote a {
    color: var(--color-fg-muted);
    text-decoration: underline;
    text-decoration-color: var(--color-border-strong);
    text-underline-offset: 2px;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .footnote a:hover { color: var(--color-fg); }
</style>
