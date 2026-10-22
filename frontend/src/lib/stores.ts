import { writable, derived } from 'svelte/store';
import type { SearchResultItem, FilterState } from '../types';

export const activeTab = writable<'search' | 'indexers'>('search');
export const searchQuery = writable<string>('');
export const isSearching = writable<boolean>(false);
export const searchError = writable<string | null>(null);

export const rawResults = writable<SearchResultItem[]>([]);

export const authRequired = writable<boolean>(false);
export const isAuthenticated = writable<boolean>(true);
export const authToken = writable<string>(typeof localStorage !== 'undefined' ? localStorage.getItem('jellypull_token') || '' : '');

export const safeSearch = writable<boolean>(true);

export async function checkAuthStatus() {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('jellypull_token') || '' : '';
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch('/api/auth/status', { headers });
    if (res.ok) {
      const data = await res.json();
      authRequired.set(data.auth_required);
      isAuthenticated.set(data.authenticated);
    }
  } catch {
    // offline or backend unreachable
  }
}

export async function loginWithPassword(password: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (res.ok) {
      const data = await res.json();
      const token = data.token || password;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('jellypull_token', token);
      }
      authToken.set(token);
      isAuthenticated.set(true);
      showToast('Unlocked personal instance', 'success');
      return true;
    } else {
      showToast('Incorrect password', 'error');
      return false;
    }
  } catch (err: any) {
    showToast(`Login failed: ${err.message}`, 'error');
    return false;
  }
}

export async function logoutInstance() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {}
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('jellypull_token');
  }
  authToken.set('');
  isAuthenticated.set(false);
  showToast('Instance locked', 'info');
}

export const filterState = writable<FilterState>({
  sortOption: 'availability',
  qualities: [],
  sizes: [],
  providers: []
});

export const isFilterSheetOpen = writable<boolean>(false);

export const expandedProviders = writable<Set<string>>(new Set());

export interface ToastMessage {
  id: number;
  type: 'success' | 'info' | 'error';
  text: string;
}
export const toastMessages = writable<ToastMessage[]>([]);

export function showToast(text: string, type: 'success' | 'info' | 'error' = 'success') {
  const id = Date.now() + Math.random();
  toastMessages.update(list => [...list, { id, type, text }]);
  setTimeout(() => {
    toastMessages.update(list => list.filter(m => m.id !== id));
  }, 3000);
}

function parseSizeInBytes(sizeStr: string): number {
  if (!sizeStr) return 0;
  const parts = sizeStr.trim().split(/\s+/);
  if (parts.length < 2) return 0;
  const val = parseFloat(parts[0]);
  const unit = parts[1].toUpperCase();
  if (isNaN(val)) return 0;

  if (unit.includes('GB')) return val * 1024 * 1024 * 1024;
  if (unit.includes('MB')) return val * 1024 * 1024;
  if (unit.includes('KB')) return val * 1024;
  if (unit.includes('TB')) return val * 1024 * 1024 * 1024 * 1024;
  if (unit.includes('B')) return val;
  return 0;
}

export const filteredResults = derived(
  [rawResults, filterState],
  ([$rawResults, $filterState]) => {
    if (!$rawResults || $rawResults.length === 0) return [];

    let list = $rawResults.filter(item => {
      if ($filterState.providers.length > 0) {
        const itemShort = (item.provider_short || '').toUpperCase();
        if (!$filterState.providers.includes(itemShort)) {
          return false;
        }
      }

      if ($filterState.qualities.length > 0) {
        const t = item.title.toLowerCase();
        const match4k = $filterState.qualities.includes('4k') && (t.includes('2160p') || t.includes('4k') || t.includes('uhd'));
        const match1080 = $filterState.qualities.includes('1080p') && (t.includes('1080p') || t.includes('bluray') || t.includes('bdrip') || t.includes('remux'));
        const match720 = $filterState.qualities.includes('720p') && (t.includes('720p') || t.includes('hdrip'));
        if (!match4k && !match1080 && !match720) return false;
      }

      if ($filterState.sizes.length > 0) {
        const bytes = parseSizeInBytes(item.size);
        const gb = bytes / (1024 * 1024 * 1024);
        const matchSmall = $filterState.sizes.includes('small') && gb < 2.0;
        const matchMedium = $filterState.sizes.includes('medium') && gb >= 2.0 && gb <= 10.0;
        const matchLarge = $filterState.sizes.includes('large') && gb > 10.0;
        if (!matchSmall && !matchMedium && !matchLarge) return false;
      }

      return true;
    });

    if ($filterState.sortOption === 'availability') {
      list.sort((a, b) => b.seeders - a.seeders);
    } else if ($filterState.sortOption === 'quality') {
      list.sort((a, b) => b.score - a.score);
    } else if ($filterState.sortOption === 'size') {
      list.sort((a, b) => parseSizeInBytes(a.size) - parseSizeInBytes(b.size));
    }

    return list;
  }
);

export interface ProviderGroup {
  providerName: string;
  providerShort: string;
  items: SearchResultItem[];
}

export const groupedResults = derived(
  filteredResults,
  ($filteredResults) => {
    const groups: Record<string, ProviderGroup> = {};
    $filteredResults.forEach(item => {
      const p = item.provider_name || 'Public Indexer';
      if (!groups[p]) {
        groups[p] = {
          providerName: p,
          providerShort: item.provider_short || 'TORRENT',
          items: []
        };
      }
      groups[p].items.push(item);
    });

    return Object.values(groups).sort((a, b) => {
      const order: Record<string, number> = {
        'SolidTorrents': 0,
        'ThePirateBay': 1,
        'YTS': 2,
        '1337x': 3,
        'EZTV': 4,
        'TorrentGalaxy': 5
      };
      const ai = order[a.providerName] ?? 99;
      const bi = order[b.providerName] ?? 99;
      return ai - bi;
    });
  }
);
