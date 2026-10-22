<script lang="ts">
  import { isFilterSheetOpen, filterState, safeSearch } from './stores';
  import type { SortOption } from '../types';

  function closeSheet() {
    isFilterSheetOpen.set(false);
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      closeSheet();
    }
  }

  function toggleQuality(q: string) {
    filterState.update(s => {
      const exists = s.qualities.includes(q);
      const qualities = exists ? s.qualities.filter(item => item !== q) : [...s.qualities, q];
      return { ...s, qualities };
    });
  }

  function toggleSize(sz: string) {
    filterState.update(s => {
      const exists = s.sizes.includes(sz);
      const sizes = exists ? s.sizes.filter(item => item !== sz) : [...s.sizes, sz];
      return { ...s, sizes };
    });
  }

  function toggleProvider(p: string) {
    filterState.update(s => {
      const exists = s.providers.includes(p);
      const providers = exists ? s.providers.filter(item => item !== p) : [...s.providers, p];
      return { ...s, providers };
    });
  }

  function setSort(opt: SortOption) {
    filterState.update(s => ({ ...s, sortOption: opt }));
  }

  function resetFilters() {
    filterState.set({
      sortOption: 'availability',
      qualities: [],
      sizes: [],
      providers: []
    });
  }
</script>

{#if $isFilterSheetOpen}
  <div class="sheet-backdrop" on:click={handleBackdropClick}>
    <aside class="sheet-panel">
      <header class="sheet-head">
        <div>
          <h2>Refine results</h2>
          <p>Sort by availability, quality, or restrict by quality, size, and provider.</p>
        </div>
        <button class="close-btn" on:click={closeSheet} aria-label="Close filters">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </header>

      <div class="sheet-content">
        <section>
          <h4 class="section-label">Sort</h4>
          <div class="segmented">
            <button class:active={$filterState.sortOption === 'availability'} on:click={() => setSort('availability')}>
              <span class="seg-ico">🔥</span>Availability
            </button>
            <button class:active={$filterState.sortOption === 'quality'} on:click={() => setSort('quality')}>
              <span class="seg-ico">💎</span>Quality
            </button>
            <button class:active={$filterState.sortOption === 'size'} on:click={() => setSort('size')}>
              <span class="seg-ico">📦</span>Size
            </button>
          </div>
        </section>

        <section>
          <h4 class="section-label">Quality</h4>
          <div class="chip-row">
            <button class="chip" class:active={$filterState.qualities.includes('4k')} on:click={() => toggleQuality('4k')}>4K / UHD</button>
            <button class="chip" class:active={$filterState.qualities.includes('1080p')} on:click={() => toggleQuality('1080p')}>1080p</button>
            <button class="chip" class:active={$filterState.qualities.includes('720p')} on:click={() => toggleQuality('720p')}>720p</button>
          </div>
        </section>

        <section>
          <h4 class="section-label">File size</h4>
          <div class="chip-row">
            <button class="chip" class:active={$filterState.sizes.includes('small')} on:click={() => toggleSize('small')}>&lt; 2 GB</button>
            <button class="chip" class:active={$filterState.sizes.includes('medium')} on:click={() => toggleSize('medium')}>2 – 10 GB</button>
            <button class="chip" class:active={$filterState.sizes.includes('large')} on:click={() => toggleSize('large')}>&gt; 10 GB</button>
          </div>
        </section>

        <section>
          <h4 class="section-label">Content Filter</h4>
          <div class="toggle-card">
            <div class="toggle-info">
              <span class="toggle-title">Safe Search (18+ Adult Blocked)</span>
              <span class="toggle-sub">Shield against adult torrents & porn categories by default</span>
            </div>
            <label class="switch">
              <input type="checkbox" bind:checked={$safeSearch} />
              <span class="slider"></span>
            </label>
          </div>
        </section>

        <section>
          <h4 class="section-label">Indexers</h4>
          <div class="chip-row">
            {#each ['SOLID', 'TPB', 'YTS', 'EZTV', '1337X', 'TGX'] as prov}
              <button class="chip provider-chip" class:active={$filterState.providers.includes(prov)} on:click={() => toggleProvider(prov)}>
                {prov}
              </button>
            {/each}
          </div>
        </section>
      </div>

      <footer class="sheet-foot">
        <button class="reset-btn" on:click={resetFilters}>Reset all</button>
        <button class="done-btn" on:click={closeSheet}>Done</button>
      </footer>
    </aside>
  </div>
{/if}

<style>
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: flex;
    justify-content: flex-end;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .sheet-panel {
    width: 100%;
    max-width: 420px;
    height: 100%;
    background: rgba(20, 20, 24, 0.96);
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    border-left: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    box-shadow: -10px 0 40px rgba(0, 0, 0, 0.55);
    animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

  .sheet-head {
    padding: 1.4rem 1.5rem;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .sheet-head h2 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 700;
    color: #F5F5F7;
    letter-spacing: -0.02em;
  }

  .sheet-head p {
    margin: 0.35rem 0 0;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.5);
    line-height: 1.4;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    border: none;
    color: rgba(255, 255, 255, 0.7);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .close-btn svg { width: 16px; height: 16px; }
  .close-btn:hover { background: rgba(255, 255, 255, 0.12); color: #FFF; }

  .sheet-content {
    flex: 1;
    padding: 1.5rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .section-label {
    margin: 0 0 0.6rem;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #0A84FF;
  }

  .segmented {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .segmented button {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    text-align: left;
    padding: 0.7rem 0.95rem;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
    color: rgba(255, 255, 255, 0.78);
    font-size: 0.88rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .segmented button:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #FFFFFF;
  }

  .segmented button.active {
    background: rgba(10, 132, 255, 0.18);
    border-color: rgba(10, 132, 255, 0.5);
    color: #64D2FF;
    font-weight: 600;
  }

  .seg-ico {
    font-size: 1rem;
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .chip {
    padding: 0.5rem 0.9rem;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
    color: rgba(255, 255, 255, 0.75);
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .chip:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #FFFFFF;
  }

  .chip.active {
    background: linear-gradient(135deg, #0A84FF, #5E5CE6);
    border-color: transparent;
    color: #FFFFFF;
    font-weight: 600;
  }

  .provider-chip {
    font-family: monospace;
    letter-spacing: 0.05em;
  }

  .sheet-foot {
    padding: 1rem 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .reset-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.88rem;
    cursor: pointer;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    transition: color 0.15s ease;
  }

  .reset-btn:hover { color: var(--accent-red); }

  .done-btn {
    background: linear-gradient(135deg, #0A84FF, #5E5CE6);
    border: none;
    color: #FFFFFF;
    padding: 0.6rem 1.4rem;
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(10, 132, 255, 0.35);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .done-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(10, 132, 255, 0.5);
  }

  .toggle-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.9rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
  }

  .toggle-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .toggle-title {
    font-size: 0.88rem;
    font-weight: 600;
    color: #F5F5F7;
  }

  .toggle-sub {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.45);
  }

  .switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
    flex-shrink: 0;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.2);
    transition: 0.2s;
    border-radius: 24px;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.2s;
    border-radius: 50%;
  }

  input:checked + .slider {
    background-color: #30D158;
  }

  input:checked + .slider:before {
    transform: translateX(20px);
  }
</style>
