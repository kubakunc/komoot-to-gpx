<script lang="ts">
  import { goto } from '$app/navigation';
  import { nativeLogin, AuthUnsupportedError, AuthCancelledError } from '$lib/client/komoot-auth';
  import { setSession } from '$lib/client/session';

  let errorMsg = $state<string | null>(null);
  let busy = $state(false);

  async function signIn() {
    errorMsg = null;
    busy = true;
    try {
      const { userId, token, email } = await nativeLogin();
      await setSession({ userId, token, email });
      await goto('/', { replaceState: true });
    } catch (e) {
      if (e instanceof AuthUnsupportedError) {
        errorMsg = 'Open this in the Android app to sign in.';
      } else if (e instanceof AuthCancelledError) {
        errorMsg = null;
      } else {
        const msg = (e as Error)?.message ?? 'unknown error';
        errorMsg = `Sign-in failed: ${msg}`;
      }
    } finally {
      busy = false;
    }
  }
</script>

<section class="auth">
  <h1>Sign in with Komoot.</h1>
  <p class="lede">
    A secure Komoot login page will open inside the app. We never see your password — we only
    receive a session cookie after you finish signing in.
  </p>

  <button onclick={signIn} disabled={busy} class="cta">
    {#if busy}
      <span class="spinner" aria-hidden="true"></span>
      Opening Komoot…
    {:else}
      Sign in with Komoot
    {/if}
  </button>

  {#if errorMsg}<p class="error">{errorMsg}</p>{/if}

  <p class="footnote">
    Don't have a Komoot account?
    <a href="https://www.komoot.com" target="_blank" rel="noopener noreferrer">
      Get one at komoot.com
    </a>
  </p>

  <p class="disclaimer">
    Not affiliated with komoot GmbH. "Komoot" is a trademark of komoot GmbH.
  </p>
</section>

<style>
  .auth { max-width: 380px; margin: 3rem auto 0; }
  .lede { color: var(--color-fg-muted); line-height: 1.55; font-size: 0.95rem; margin: 0.5rem 0 2rem; }
  .cta {
    width: 100%; height: 48px; padding: 0 1.1rem;
    background: var(--color-fg); color: var(--color-bg);
    border: 0; border-radius: var(--radius-sm);
    font-size: 1rem; font-weight: 500;
    display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
    transition: background 0.15s, transform 0.15s;
  }
  .cta:hover { background: var(--color-accent); }
  .cta:active { transform: scale(0.99); }
  .cta:disabled { opacity: 0.65; cursor: progress; }
  .spinner {
    width: 14px; height: 14px;
    border: 1.5px solid currentColor; border-right-color: transparent;
    border-radius: 50%; animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .error { color: var(--color-error); margin: 1rem 0 0; font-size: 0.9rem; }
  .footnote { margin-top: 2rem; color: var(--color-fg-subtle); font-size: 0.85rem; }
  .footnote a {
    color: var(--color-fg-muted); text-decoration: underline;
    text-decoration-color: var(--color-border-strong); text-underline-offset: 2px;
  }
  .footnote a:hover { color: var(--color-fg); }
  .disclaimer { margin-top: 2.5rem; color: var(--color-fg-subtle); font-size: 0.72rem; line-height: 1.4; }
</style>
