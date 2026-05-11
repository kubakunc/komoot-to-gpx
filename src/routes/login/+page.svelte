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
        errorMsg = 'Nieprawidłowy email lub hasło.';
        return;
      }
      if (res.status === 429) {
        errorMsg = 'Zbyt wiele prób. Spróbuj za chwilę.';
        return;
      }
      if (!res.ok) {
        errorMsg = 'Komoot nie odpowiada. Spróbuj ponownie.';
        return;
      }
      const data = (await res.json()) as { userId: string; token: string };
      setSession({ email, userId: data.userId, token: data.token });
      await goto('/', { replaceState: true });
    } catch {
      errorMsg = 'Brak połączenia.';
    } finally {
      busy = false;
    }
  }
</script>

<section class="auth">
  <div class="auth-art" aria-hidden="true">
    <svg viewBox="0 0 320 240" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(28,33,26,0.08)" stroke-width="0.5" />
        </pattern>
      </defs>
      <rect width="320" height="240" fill="url(#grid)" />
      <!-- decorative route line -->
      <path
        d="M20 200 Q 60 130, 100 160 T 180 90 Q 230 60, 260 110 T 300 50"
        fill="none"
        stroke="var(--color-terra)"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-dasharray="0"
      />
      <path
        d="M20 200 Q 60 130, 100 160 T 180 90 Q 230 60, 260 110 T 300 50"
        fill="none"
        stroke="rgba(183,89,65,0.25)"
        stroke-width="6"
        stroke-linecap="round"
      />
      <circle cx="20" cy="200" r="5" fill="var(--color-forest)" />
      <circle cx="300" cy="50" r="5" fill="var(--color-terra-deep)" />
      <!-- elevation contour decoration -->
      <path d="M40 220 Q 100 195, 180 215 T 300 200" fill="none" stroke="rgba(45,64,48,0.18)" stroke-width="0.8" />
      <path d="M30 235 Q 120 215, 220 230 T 310 220" fill="none" stroke="rgba(45,64,48,0.14)" stroke-width="0.8" />
    </svg>
  </div>

  <div class="auth-form">
    <span class="kicker">witaj z powrotem</span>
    <h1>Zaloguj się<br />kontem Komoot.</h1>
    <p class="lede">
      Hasło ląduje wyłącznie w pamięci serwera podczas pojedynczego żądania — wymieniamy je
      natychmiast na token Komoota. Tego tokenu używamy do pobierania Twoich tras.
    </p>

    <form onsubmit={submit}>
      <label>
        <span class="lbl">email</span>
        <input type="email" bind:value={email} required autocomplete="username" placeholder="ty@example.com" />
      </label>
      <label>
        <span class="lbl">hasło</span>
        <input type="password" bind:value={password} required autocomplete="current-password" placeholder="•••••••••" />
      </label>
      {#if errorMsg}<p class="error">{errorMsg}</p>{/if}
      <button type="submit" disabled={busy}>
        {#if busy}
          <span class="spinner" aria-hidden="true"></span>
          logowanie…
        {:else}
          Wejdź na trasę →
        {/if}
      </button>
    </form>
  </div>
</section>

<style>
  .auth {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
    max-width: 880px;
    margin: 1rem auto 0;
    align-items: center;
  }
  @media (min-width: 760px) {
    .auth {
      grid-template-columns: 1.1fr 1fr;
      gap: 3rem;
    }
  }

  .auth-art {
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    overflow: hidden;
    background: var(--color-paper-warm);
    box-shadow: inset 0 0 60px rgba(28, 33, 26, 0.06);
  }
  .auth-art svg { display: block; width: 100%; height: auto; }

  .kicker {
    display: inline-block;
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-terra);
    font-weight: 600;
  }
  h1 {
    margin: 0.4rem 0 0.8rem;
    font-size: clamp(1.8rem, 4vw, 2.4rem);
  }
  .lede {
    color: var(--color-ink-soft);
    line-height: 1.55;
    font-size: 0.95rem;
    margin: 0 0 1.8rem;
    max-width: 44ch;
  }

  form { display: grid; gap: 0.9rem; max-width: 380px; }

  .lbl {
    display: block;
    font-size: 0.65rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-sage);
    margin-bottom: 0.3rem;
    font-weight: 600;
  }
  label { display: block; }

  input {
    width: 100%;
    padding: 0.7rem 0.85rem;
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.5);
    font: inherit;
    color: var(--color-ink);
    transition: border-color 0.15s, background 0.15s;
  }
  input::placeholder { color: var(--color-sage); }
  input:focus {
    outline: none;
    border-color: var(--color-terra);
    background: white;
  }

  button[type="submit"] {
    margin-top: 0.6rem;
    padding: 0.75rem 1.1rem;
    background: var(--color-ink);
    color: var(--color-paper);
    border: 0;
    border-radius: 4px;
    font-size: 0.95rem;
    font-weight: 500;
    letter-spacing: 0.02em;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: background 0.15s, transform 0.15s;
  }
  button[type="submit"]:hover { background: var(--color-terra); }
  button[type="submit"]:active { transform: scale(0.98); }
  button[type="submit"]:disabled { opacity: 0.6; cursor: progress; }

  .spinner {
    width: 12px; height: 12px;
    border: 1.5px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .error { color: var(--color-error); margin: 0; font-size: 0.9rem; }
</style>
