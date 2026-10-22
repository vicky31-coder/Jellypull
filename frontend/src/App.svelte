<script lang="ts">
  import { onMount } from 'svelte';
  import Header from './lib/Header.svelte';
  import SpotlightSearch from './lib/SpotlightSearch.svelte';
  import ResultsList from './lib/ResultsList.svelte';
  import FilterSheet from './lib/FilterSheet.svelte';
  import Toast from './lib/Toast.svelte';
  import IndexersView from './lib/SettingsTab.svelte';
  import AuthModal from './lib/AuthModal.svelte';
  import { activeTab, checkAuthStatus } from './lib/stores';

  onMount(() => {
    checkAuthStatus();
  });
</script>

<div class="app-root">
  <Header />

  <main class="main-content">
    {#if $activeTab === 'search'}
      <SpotlightSearch />
      <ResultsList />
    {:else if $activeTab === 'indexers'}
      <IndexersView />
    {/if}
  </main>

  <FilterSheet />
  <Toast />
  <AuthModal />
</div>

<style>
  :global(:root) {
    --bg-base: #0B0B0E;
    --bg-surface: #15151A;
    --accent-blue: #0A84FF;
    --accent-violet: #5E5CE6;
    --accent-green: #30D158;
    --accent-amber: #FF9F0A;
    --accent-red: #FF453A;
    --text-primary: #F5F5F7;
    --text-secondary: rgba(255, 255, 255, 0.6);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color-scheme: dark;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    background-color: var(--bg-base);
    color: var(--text-primary);
    background-image:
      radial-gradient(circle at 20% -10%, rgba(10, 132, 255, 0.10) 0%, transparent 55%),
      radial-gradient(circle at 90% 110%, rgba(94, 92, 230, 0.06) 0%, transparent 50%);
    background-attachment: fixed;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }

  .app-root {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .main-content {
    flex: 1;
  }
</style>
