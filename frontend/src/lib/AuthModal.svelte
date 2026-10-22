<script lang="ts">
  import { authRequired, isAuthenticated, loginWithPassword } from './stores';

  let password = '';
  let errorMsg = '';
  let isSubmitting = false;
  let showPassword = false;

  async function handleSubmit() {
    if (!password.trim()) {
      errorMsg = 'Please enter your password.';
      return;
    }

    isSubmitting = true;
    errorMsg = '';
    const success = await loginWithPassword(password);
    isSubmitting = false;

    if (!success) {
      errorMsg = 'Incorrect instance password. Try again.';
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  }
</script>

{#if $authRequired && !$isAuthenticated}
  <div class="lock-backdrop">
    <div class="lock-card">
      <div class="brand-badge">
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="lockBrandGrad" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
              <stop stop-color="#0A84FF" />
              <stop offset="1" stop-color="#5E5CE6" />
            </linearGradient>
          </defs>
          <path d="M6 15C6 9.477 10.477 5 16 5s10 4.477 10 10c0 3.5-2 5-5 5-1.5 0-2.5-1-4-1s-2.5 1-4 1c-3 0-7-1.5-7-5z" fill="url(#lockBrandGrad)" />
          <path d="M10 20v6c0 1 1 1.5 1.5.5s1-2.5 1.5-2.5 1 1.5 1.5 2.5 1.5.5 1.5-.5v-6M16 20v6c0 1 1 1.5 1.5.5s1-2.5 1.5-2.5 1 1.5 1.5 2.5 1.5.5 1.5-.5v-6" stroke="#0A84FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="12" cy="13" r="1.5" fill="#FFFFFF" />
          <circle cx="20" cy="13" r="1.5" fill="#FFFFFF" />
        </svg>
      </div>

      <h2 class="lock-title">Jellypull Personal Instance</h2>
      <p class="lock-sub">Enter the instance password configured in your server environment to unlock search and downloads.</p>

      <div class="input-wrap">
        {#if showPassword}
          <input
            type="text"
            class="password-input"
            placeholder="Master password"
            bind:value={password}
            on:keydown={handleKeydown}
            disabled={isSubmitting}
            autocomplete="current-password"
            autofocus
          />
        {:else}
          <input
            type="password"
            class="password-input"
            placeholder="Master password"
            bind:value={password}
            on:keydown={handleKeydown}
            disabled={isSubmitting}
            autocomplete="current-password"
            autofocus
          />
        {/if}

        <button
          class="toggle-eye"
          type="button"
          on:click={() => showPassword = !showPassword}
          title={showPassword ? 'Hide password' : 'Show password'}
        >
          {#if showPassword}
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.375l1.091 1.091a4 4 0 00-5.557-5.557z" clip-rule="evenodd" />
              <path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 014.5 5.88l2.09 2.09a4.004 4.004 0 004.158 5.96z" />
            </svg>
          {:else}
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
              <path fill-rule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
            </svg>
          {/if}
        </button>
      </div>

      {#if errorMsg}
        <div class="error-badge">{errorMsg}</div>
      {/if}

      <button class="unlock-btn" on:click={handleSubmit} disabled={isSubmitting}>
        {#if isSubmitting}
          <span class="btn-spinner"></span>
          <span>Unlocking…</span>
        {:else}
          <span>Unlock Instance</span>
        {/if}
      </button>

      <footer class="lock-foot">
        <span>Single-user homelab deployment · Safe search enabled by default</span>
      </footer>
    </div>
  </div>
{/if}

<style>
  .lock-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(11, 11, 14, 0.88);
    backdrop-filter: blur(32px) saturate(180%);
    -webkit-backdrop-filter: blur(32px) saturate(180%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .lock-card {
    width: 100%;
    max-width: 440px;
    background: linear-gradient(135deg, rgba(26, 26, 30, 0.95), rgba(18, 18, 22, 0.95));
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
    border-radius: 24px;
    padding: 2.25rem 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    animation: lockPop 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes lockPop {
    from { transform: scale(0.94); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .brand-badge {
    width: 58px;
    height: 58px;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(10, 132, 255, 0.2), rgba(94, 92, 230, 0.2));
    border: 1px solid rgba(10, 132, 255, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.25rem;
  }

  .brand-badge svg {
    width: 34px;
    height: 34px;
  }

  .lock-title {
    font-size: 1.4rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #F5F5F7;
    margin: 0 0 0.5rem;
  }

  .lock-sub {
    font-size: 0.86rem;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.55);
    margin: 0 0 1.75rem;
  }

  .input-wrap {
    width: 100%;
    position: relative;
    margin-bottom: 1rem;
  }

  .password-input {
    width: 100%;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    padding: 0.85rem 2.8rem 0.85rem 1rem;
    font-size: 0.95rem;
    color: #F5F5F7;
    outline: none;
    transition: all 0.2s ease;
  }

  .password-input:focus {
    border-color: #0A84FF;
    background: rgba(255, 255, 255, 0.08);
    box-shadow: 0 0 0 4px rgba(10, 132, 255, 0.2);
  }

  .toggle-eye {
    position: absolute;
    right: 0.85rem;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s ease;
  }

  .toggle-eye:hover {
    color: rgba(255, 255, 255, 0.8);
  }

  .toggle-eye svg {
    width: 18px;
    height: 18px;
  }

  .error-badge {
    width: 100%;
    background: rgba(255, 69, 58, 0.12);
    border: 1px solid rgba(255, 69, 58, 0.3);
    color: #FF453A;
    font-size: 0.82rem;
    font-weight: 500;
    padding: 0.6rem 0.8rem;
    border-radius: 10px;
    margin-bottom: 1rem;
  }

  .unlock-btn {
    width: 100%;
    background: linear-gradient(135deg, #0A84FF, #5E5CE6);
    border: none;
    border-radius: 12px;
    padding: 0.85rem 1.25rem;
    font-size: 0.95rem;
    font-weight: 600;
    color: #FFFFFF;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    box-shadow: 0 4px 18px rgba(10, 132, 255, 0.35);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .unlock-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 22px rgba(10, 132, 255, 0.5);
  }

  .unlock-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #FFFFFF;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .lock-foot {
    margin-top: 1.5rem;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
  }
</style>
