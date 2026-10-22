<script lang="ts">
  import { toastMessages } from './stores';
</script>

<div class="toast-viewport">
  {#each $toastMessages as toast (toast.id)}
    <div class="toast-item {toast.type}">
      {#if toast.type === 'success'}
        <span class="toast-icon">✓</span>
      {:else if toast.type === 'error'}
        <span class="toast-icon">✕</span>
      {:else}
        <span class="toast-icon">ℹ</span>
      {/if}
      <span class="toast-text">{toast.text}</span>
    </div>
  {/each}
</div>

<style>
  .toast-viewport {
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 500;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    pointer-events: none;
  }

  .toast-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.65rem 1.25rem;
    border-radius: 30px;
    background: rgba(28, 28, 32, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
    font-size: 0.88rem;
    font-weight: 500;
    color: #F5F5F7;
    animation: toastPop 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: auto;
  }

  @keyframes toastPop {
    from { transform: translateY(20px) scale(0.9); opacity: 0; }
    to { transform: translateY(0) scale(1); opacity: 1; }
  }

  .toast-item.success {
    border-color: rgba(48, 209, 88, 0.4);
  }

  .toast-item.success .toast-icon {
    color: #30D158;
    font-weight: 800;
  }

  .toast-item.error {
    border-color: rgba(255, 69, 58, 0.4);
  }

  .toast-item.error .toast-icon {
    color: #FF453A;
    font-weight: 800;
  }

  .toast-item.info .toast-icon {
    color: #0A84FF;
    font-weight: 800;
  }
</style>
