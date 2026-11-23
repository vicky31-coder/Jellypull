"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OctopusIcon } from "./OctopusIcon";

type TabId = "search" | "downloads" | "settings";
type ThemeMode = "auto" | "light" | "dark";

interface SearchResult {
  id: string;
  title: string;
  clean_name: string;
  quality: string;
  size: string;
  seeders: number;
  magnet: string;
}

interface QbitStatus {
  connected: boolean;
  configured: boolean;
  url: string;
  username: string;
  version?: string;
  error?: string;
}

interface QbitTorrent {
  hash: string;
  name: string;
  size: number;
  progress: number;
  dlspeed: number;
  upspeed: number;
  num_seeds: number;
  num_leechs: number;
  state: string;
  eta: number;
  category: string;
  added_on: number;
  amount_left: number;
  downloaded: number;
  uploaded: number;
  ratio: number;
}

interface QbitTransferInfo {
  dl_info_speed: number;
  up_info_speed: number;
  dl_info_data: number;
  up_info_data: number;
  connection_status: string;
}

interface QbitTorrentFile {
  index: number;
  name: string;
  size: number;
  progress: number;
  priority: number;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, idx);
  return `${val >= 100 ? val.toFixed(0) : val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

function formatEta(seconds: number): string {
  if (!seconds || seconds >= 8640000 || seconds < 0) return "∞";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function isTorrentPaused(state: string): boolean {
  const lower = state.toLowerCase();
  return lower.includes("paused") || lower.includes("stopped");
}

function formatStateLabel(state: string): string {
  const s = state.toLowerCase();
  if (s === "downloading" || s === "forceddl" || s === "metadl") return "Downloading";
  if (s === "uploading" || s === "forcedup" || s === "stalledup") {
    return s === "stalledup" ? "Seeding (Idle)" : "Seeding";
  }
  if (s.includes("paused") || s.includes("stopped")) return "Paused";
  if (s.includes("stalled")) return "Stalled";
  if (s.includes("checking")) return "Checking";
  if (s.includes("queued")) return "Queued";
  if (s === "error" || s === "missingfiles") return "Error";
  return state;
}

export function JellypullShell({ username }: { username: string }) {
  const router = useRouter();
  const snackbarRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const logoutDialogRef = useRef<HTMLElement | null>(null);
  const fileDialogRef = useRef<HTMLElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);

  const [tab, setTab] = useState<TabId>("search");
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [snackMsg, setSnackMsg] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>("auto");
  const [currentUsername, setCurrentUsername] = useState(username);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  // Search state
  const [query, setQuery] = useState("");
  const [safeSearch, setSafeSearch] = useState(true);
  const [qualityFilter, setQualityFilter] = useState<string>("ALL");
  const [filterOpen, setFilterOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});

  // File Selection Modal state (before starting download)
  const [filePickerItem, setFilePickerItem] = useState<SearchResult | null>(null);
  const [filePickerLoading, setFilePickerLoading] = useState(false);
  const [filePickerHash, setFilePickerHash] = useState<string | null>(null);
  const filePickerHashRef = useRef<string | null>(null);
  const [filePickerFiles, setFilePickerFiles] = useState<QbitTorrentFile[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<number>>(new Set());
  const [filePickerError, setFilePickerError] = useState<string | null>(null);
  const [confirmingDownload, setConfirmingDownload] = useState(false);

  // Account credentials update state
  const [accountCardOpen, setAccountCardOpen] = useState(false);
  const [accountUsername, setAccountUsername] = useState(username);
  const [accountCurrentPass, setAccountCurrentPass] = useState("");
  const [accountNewPass, setAccountNewPass] = useState("");
  const [accountConfirmPass, setAccountConfirmPass] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  // qBittorrent state
  const [qbitCardOpen, setQbitCardOpen] = useState(false);
  const [qbitStatus, setQbitStatus] = useState<QbitStatus | null>(null);
  const [qbitUrl, setQbitUrl] = useState("http://127.0.0.1:8085");
  const [qbitUser, setQbitUser] = useState("");
  const [qbitPass, setQbitPass] = useState("");
  const [connectingQbit, setConnectingQbit] = useState(false);
  const [stopSeeding, setStopSeeding] = useState(false);
  const [savingSeeding, setSavingSeeding] = useState(false);
  const [torrents, setTorrents] = useState<QbitTorrent[]>([]);
  const [transfer, setTransfer] = useState<QbitTransferInfo | null>(null);
  const [torrentsError, setTorrentsError] = useState<string | null>(null);
  const [busyHash, setBusyHash] = useState<string | null>(null);

  // Delete confirmation dialog state (auto-removes downloaded files from disk)
  const [deleteTarget, setDeleteTarget] = useState<QbitTorrent | null>(null);

  const notify = useCallback((message: string) => {
    setSnackMsg(message);
    const el = snackbarRef.current as (HTMLElement & { open?: boolean }) | null;
    if (el) {
      el.open = true;
    }
  }, []);

  const loadSeedingPreference = useCallback(async () => {
    try {
      const res = await fetch("/api/qbit/seeding");
      if (res.ok) {
        const data = (await res.json()) as { stopSeeding?: boolean };
        setStopSeeding(Boolean(data.stopSeeding));
      }
    } catch {
      // ignore if qBittorrent is not connected yet
    }
  }, []);

  const loadQbitStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/qbit/connect");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await res.json()) as QbitStatus;
      setQbitStatus(data);
      if (!data.connected) {
        setQbitCardOpen(true);
      } else {
        loadSeedingPreference();
      }
      if (data.url) setQbitUrl(data.url);
      if (data.username) setQbitUser(data.username);
    } catch {
      // ignore initial status fetch failures
    }
  }, [router, loadSeedingPreference]);

  const loadTorrents = useCallback(async () => {
    try {
      const res = await fetch("/api/qbit/torrents");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await res.json()) as {
        torrents?: QbitTorrent[];
        transfer?: QbitTransferInfo;
        error?: string;
      };
      if (!res.ok) {
        setTorrentsError(data.error || "qBittorrent is not connected.");
      } else {
        setTorrents(data.torrents || []);
        setTransfer(data.transfer || null);
        setTorrentsError(null);
      }
    } catch {
      setTorrentsError("Unable to reach qBittorrent API proxy.");
    }
  }, [router]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth <= 840) {
      setDrawerOpen(false);
    }
    const savedTheme = localStorage.getItem("jellypull_theme") as ThemeMode | null;
    if (savedTheme) setThemeMode(savedTheme);
    loadQbitStatus();

    const dialogEl = dialogRef.current;
    const onDialogClose = () => setDeleteTarget(null);
    dialogEl?.addEventListener("close", onDialogClose);

    const logoutEl = logoutDialogRef.current;
    const onLogoutClose = () => setLogoutConfirmOpen(false);
    logoutEl?.addEventListener("close", onLogoutClose);

    const drawerEl = drawerRef.current;
    const onDrawerClose = () => setDrawerOpen(false);
    drawerEl?.addEventListener("close", onDrawerClose);

    const fileDialogEl = fileDialogRef.current;
    const onFileDialogClose = () => {
      const h = filePickerHashRef.current;
      filePickerHashRef.current = null;
      setFilePickerItem(null);
      setFilePickerHash(null);
      setFilePickerFiles([]);
      if (h) {
        fetch("/api/qbit/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hash: h, cancel: true }),
        }).catch(() => {});
      }
    };
    fileDialogEl?.addEventListener("close", onFileDialogClose);

    const snackEl = snackbarRef.current as (HTMLElement & { open?: boolean }) | null;
    const onSnackClose = () => {
      if (snackEl) snackEl.open = false;
    };
    snackEl?.addEventListener("close", onSnackClose);

    return () => {
      dialogEl?.removeEventListener("close", onDialogClose);
      logoutEl?.removeEventListener("close", onLogoutClose);
      drawerEl?.removeEventListener("close", onDrawerClose);
      fileDialogEl?.removeEventListener("close", onFileDialogClose);
      snackEl?.removeEventListener("close", onSnackClose);
    };
  }, [loadQbitStatus]);

  useEffect(() => {
    if (!qbitStatus?.connected && tab !== "downloads") return;
    loadTorrents();
    const interval = setInterval(loadTorrents, tab === "downloads" ? 2500 : 8000);
    return () => clearInterval(interval);
  }, [tab, qbitStatus?.connected, loadTorrents]);

  function selectTab(next: TabId) {
    setTab(next);
    if (typeof window !== "undefined" && window.innerWidth <= 840) {
      setDrawerOpen(false);
    }
  }

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(trimmed)}&safe=${safeSearch ? "1" : "0"}`
      );
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await res.json()) as { results?: SearchResult[]; error?: string };
      if (!res.ok) {
        setResults([]);
        setSearchError(data.error || "Search failed.");
      } else {
        setResults(data.results || []);
        if (!data.results || data.results.length === 0) {
          setSearchError(`No torrents found for "${trimmed}".`);
        }
      }
    } catch {
      setSearchError("Network error while searching.");
    } finally {
      setSearching(false);
    }
  }

  async function openFilePickerForDownload(item: SearchResult) {
    setFilePickerItem(item);
    setFilePickerLoading(true);
    setFilePickerHash(null);
    setFilePickerFiles([]);
    setSelectedFileIds(new Set());
    setFilePickerError(null);

    try {
      const res = await fetch("/api/qbit/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ magnet: item.magnet }),
      });
      const data = (await res.json()) as {
        hash?: string;
        ready?: boolean;
        files?: QbitTorrentFile[];
        error?: string;
      };
      if (!res.ok) {
        setFilePickerError(data.error || "Could not fetch torrent metadata from qBittorrent.");
      } else {
        filePickerHashRef.current = data.hash || null;
        setFilePickerHash(data.hash || null);
        const files = data.files || [];
        setFilePickerFiles(files);
        setSelectedFileIds(new Set(files.map((f) => f.index)));
        if (!data.ready || files.length === 0) {
          setFilePickerError("Metadata is still resolving from peers. You can wait or start downloading all files.");
        }
      }
    } catch {
      setFilePickerError("Network error communicating with qBittorrent.");
    } finally {
      setFilePickerLoading(false);
    }
  }

  async function handleCancelFilePicker() {
    const hash = filePickerHash;
    filePickerHashRef.current = null;
    setFilePickerItem(null);
    setFilePickerHash(null);
    setFilePickerFiles([]);
    if (hash) {
      await fetch("/api/qbit/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash, cancel: true }),
      }).catch(() => {});
      loadTorrents();
    }
  }

  async function handleConfirmFilePicker() {
    if (!filePickerItem) return;
    setConfirmingDownload(true);
    try {
      if (filePickerHash) {
        const unselectedIds = filePickerFiles
          .filter((f) => !selectedFileIds.has(f.index))
          .map((f) => f.index);

        const res = await fetch("/api/qbit/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hash: filePickerHash,
            unselectedIds,
            stopSeeding,
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          notify(data.error || "Failed to start download.");
          return;
        }
      } else {
        const res = await fetch("/api/qbit/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ magnet: filePickerItem.magnet, stopSeeding }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          notify(data.error || "Failed to start download.");
          return;
        }
      }

      setAddedIds((prev) => ({ ...prev, [filePickerItem.id]: true }));
      notify(`Downloading: ${filePickerItem.clean_name}`);
      filePickerHashRef.current = null;
      setFilePickerItem(null);
      setFilePickerHash(null);
      setFilePickerFiles([]);
      loadTorrents();
    } catch {
      notify("Error starting download.");
    } finally {
      setConfirmingDownload(false);
    }
  }

  async function handleCopyMagnet(item: SearchResult) {
    try {
      await navigator.clipboard.writeText(item.magnet);
      notify(`Copied magnet for ${item.clean_name}`);
    } catch {
      notify("Clipboard copy blocked by browser.");
    }
  }

  async function handleConnectQbit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const resolvedUrl = String(formData.get("qbit_url") ?? qbitUrl).trim();
    const resolvedUser = String(formData.get("qbit_username") ?? qbitUser).trim();
    const resolvedPass = String(formData.get("qbit_password") ?? qbitPass);

    setConnectingQbit(true);
    try {
      const res = await fetch("/api/qbit/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: resolvedUrl,
          username: resolvedUser,
          password: resolvedPass,
        }),
      });
      const data = (await res.json()) as QbitStatus & { error?: string };
      if (!res.ok) {
        notify(data.error || "Could not authenticate with qBittorrent.");
        setQbitStatus((prev) => ({
          url: resolvedUrl,
          username: resolvedUser,
          configured: prev?.configured || false,
          connected: false,
          error: data.error,
        }));
      } else {
        setQbitStatus({
          connected: true,
          configured: true,
          url: data.url,
          username: data.username,
          version: data.version,
        });
        setQbitPass("");
        setQbitCardOpen(false);
        notify(`Connected to qBittorrent ${data.version || ""}`);
        loadSeedingPreference();
        loadTorrents();
      }
    } catch {
      notify("Network error connecting to qBittorrent.");
    } finally {
      setConnectingQbit(false);
    }
  }

  async function handleToggleStopSeeding() {
    const next = !stopSeeding;
    setSavingSeeding(true);
    try {
      const res = await fetch("/api/qbit/seeding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stopSeeding: next }),
      });
      const data = (await res.json()) as { stopSeeding?: boolean; error?: string };
      if (!res.ok) {
        notify(data.error || "Connect qBittorrent first to save seeding preference.");
      } else {
        setStopSeeding(Boolean(data.stopSeeding));
        notify(
          next
            ? "Auto-stop seeding enabled after completion"
            : "Auto-stop seeding disabled"
        );
      }
    } catch {
      notify("Failed to update seeding preference.");
    } finally {
      setSavingSeeding(false);
    }
  }

  async function handleTorrentAction(
    action: "pause" | "resume" | "delete" | "deleteFiles",
    hash: string
  ) {
    setBusyHash(hash);
    try {
      const res = await fetch("/api/qbit/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, hashes: [hash] }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        notify(data.error || `Failed to ${action} torrent`);
      } else {
        await loadTorrents();
      }
    } catch {
      notify("Failed to execute torrent action.");
    } finally {
      setBusyHash(null);
    }
  }

  async function handleUpdateAccount(e: React.FormEvent) {
    e.preventDefault();
    setAccountError(null);

    if (!accountCurrentPass) {
      setAccountError("Enter your current password to confirm changes.");
      return;
    }
    if (accountNewPass && accountNewPass !== accountConfirmPass) {
      setAccountError("New password and confirmation do not match.");
      return;
    }

    setSavingAccount(true);
    try {
      const res = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: accountCurrentPass,
          newUsername: accountUsername.trim(),
          newPassword: accountNewPass || undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        username?: string;
        passwordUpdated?: boolean;
      };
      if (!res.ok) {
        setAccountError(data.error || "Failed to update credentials.");
      } else {
        if (data.username) {
          setCurrentUsername(data.username);
          setAccountUsername(data.username);
        }
        setAccountCurrentPass("");
        setAccountNewPass("");
        setAccountConfirmPass("");
        setAccountCardOpen(false);
        notify(
          data.passwordUpdated
            ? "Login username & password updated"
            : `Login username updated to ${data.username}`
        );
      }
    } catch {
      setAccountError("Network error while updating account.");
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleLogout() {
    setLogoutConfirmOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function applyTheme(mode: ThemeMode) {
    setThemeMode(mode);
    localStorage.setItem("jellypull_theme", mode);
    const { setTheme } = await import("mdui");
    setTheme(mode);
  }

  const filteredResults = useMemo(() => {
    const qf = qualityFilter.toUpperCase();
    const list =
      qf === "ALL"
        ? results
        : results.filter((r) => {
            const qual = (r.quality || "").toUpperCase();
            const title = (r.title || "").toUpperCase();
            if (qf === "2160P") {
              return (
                qual.includes("2160P") ||
                title.includes("2160P") ||
                title.includes("4K") ||
                title.includes("UHD")
              );
            }
            return qual.includes(qf) || title.includes(qf);
          });

    return [...list].sort((a, b) => (b.seeders || 0) - (a.seeders || 0));
  }, [results, qualityFilter]);

  const activeDownloadCount = useMemo(
    () =>
      torrents.filter((t) => {
        const s = t.state.toLowerCase();
        return s === "downloading" || s === "forceddl" || s === "metadl" || s === "stalleddl";
      }).length,
    [torrents]
  );

  const selectedFilesTotalBytes = useMemo(
    () =>
      filePickerFiles
        .filter((f) => selectedFileIds.has(f.index))
        .reduce((acc, f) => acc + f.size, 0),
    [filePickerFiles, selectedFileIds]
  );

  return (
    <mdui-layout className="app-shell">
      {/* Mobile-Only Minimal App Bar */}
      <mdui-top-app-bar className="mobile-topbar" variant="small" scroll-behavior="elevate">
        <mdui-button-icon icon="menu" onClick={() => setDrawerOpen((v) => !v)} />
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginLeft: "4px" }}>
          <div className="brand-pill-badge">
            <OctopusIcon size={20} />
          </div>
          <mdui-top-app-bar-title>Jellypull</mdui-top-app-bar-title>
        </div>
      </mdui-top-app-bar>

      {/* Full-Height Material 3 Sidebar (Permanent on Desktop, Drawer on Mobile) */}
      <mdui-navigation-drawer
        ref={(el: HTMLElement | null) => {
          drawerRef.current = el;
        }}
        className="sidebar-drawer"
        open={drawerOpen}
        close-on-esc
        close-on-overlay-click
      >
        <div className="sidebar-inner">
          {/* Brand inside Sidebar */}
          <div className="sidebar-brand">
            <div className="brand-pill-badge" title="Jellypull">
              <OctopusIcon size={22} />
            </div>
            <span className="sidebar-brand-title">Jellypull</span>
          </div>

          {/* Primary Navigation */}
          <mdui-list className="sidebar-nav">
            <mdui-list-item
              rounded
              icon="search"
              active={tab === "search"}
              onClick={() => selectTab("search")}
            >
              Search
            </mdui-list-item>

            <mdui-list-item
              rounded
              icon="downloading"
              active={tab === "downloads"}
              onClick={() => selectTab("downloads")}
            >
              Downloads
              {activeDownloadCount > 0 && (
                <mdui-badge slot="end-icon">{activeDownloadCount}</mdui-badge>
              )}
            </mdui-list-item>

            <mdui-list-item
              rounded
              icon="settings"
              active={tab === "settings"}
              onClick={() => selectTab("settings")}
            >
              Settings
            </mdui-list-item>
          </mdui-list>

          {/* Bottom User & Sign Out */}
          <div className="sidebar-footer">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "4px 8px",
                fontSize: "0.84rem",
                color: "rgb(var(--mdui-color-on-surface-variant))",
              }}
            >
              <mdui-icon name="account_circle" style={{ fontSize: "20px" }} />
              <span style={{ fontWeight: 600 }}>{currentUsername}</span>
            </div>

            <mdui-button
              variant="outlined"
              icon="logout"
              full-width
              onClick={() => setLogoutConfirmOpen(true)}
            >
              Sign out
            </mdui-button>
          </div>
        </div>
      </mdui-navigation-drawer>

      {/* Main Content */}
      <mdui-layout-main>
        <div className="main-container">
          {/* ==================== SEARCH TAB ==================== */}
          {tab === "search" && (
            <section>
              <div style={{ marginBottom: "14px" }}>
                <h1 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0 }}>
                  Search
                </h1>
              </div>

              <form onSubmit={handleSearch} className="search-row">
                <div className="search-pill-form" style={{ height: "44px" }}>
                  <input
                    type="search"
                    className="search-pill-input"
                    placeholder="Search movies, shows, or releases..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search torrents"
                  />
                  {query && (
                    <mdui-button-icon
                      type="button"
                      icon="close"
                      title="Clear search"
                      onClick={() => {
                        setQuery("");
                        setResults([]);
                        setSearchError(null);
                      }}
                    />
                  )}
                </div>

                <mdui-button-icon
                  type="submit"
                  variant="filled"
                  icon={searching ? "hourglass_top" : "search"}
                  title="Search"
                  aria-label="Search"
                  disabled={searching || !query.trim()}
                  style={{ width: "44px", height: "44px", flexShrink: 0 }}
                />

                <mdui-button-icon
                  type="button"
                  variant={filterOpen || qualityFilter !== "ALL" || !safeSearch ? "tonal" : "outlined"}
                  icon="tune"
                  title={filterOpen ? "Hide filters" : "Show filters"}
                  aria-label="Toggle filters"
                  aria-expanded={filterOpen}
                  onClick={() => setFilterOpen((v) => !v)}
                  style={{ width: "44px", height: "44px", flexShrink: 0 }}
                />
              </form>

              {filterOpen && (
                <div className="filter-tray">
                  <span className="filter-tray-label">Filters</span>
                  <mdui-chip
                    variant="filter"
                    selected={safeSearch}
                    icon={safeSearch ? "shield" : "gpp_maybe"}
                    onClick={() => setSafeSearch((v) => !v)}
                  >
                    Safe Search: {safeSearch ? "ON" : "OFF"}
                  </mdui-chip>

                  {["ALL", "2160p", "1080p", "720p"].map((q) => (
                    <mdui-chip
                      key={q}
                      variant="filter"
                      selected={qualityFilter === q}
                      onClick={() => setQualityFilter(q)}
                    >
                      {q === "ALL" ? "All Qualities" : q}
                    </mdui-chip>
                  ))}
                </div>
              )}

              {searching && <mdui-linear-progress style={{ marginBottom: "16px" }} />}

              {searchError && (
                <mdui-card
                  variant="outlined"
                  className="item-card"
                  style={{
                    marginBottom: "14px",
                    borderColor: "rgb(var(--mdui-color-error))",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <mdui-icon name="error_outline" />
                    <span>{searchError}</span>
                  </div>
                </mdui-card>
              )}

              {!searching && results.length === 0 && !searchError && (
                <mdui-card
                  variant="filled"
                  className="item-card"
                  style={{ textAlign: "center", padding: "32px 20px" }}
                >
                  <mdui-icon name="movie_filter" style={{ fontSize: "36px", opacity: 0.7 }} />
                  <h3 style={{ margin: "8px 0 4px", fontSize: "1rem" }}>Ready to Search</h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.86rem",
                      color: "rgb(var(--mdui-color-on-surface-variant))",
                    }}
                  >
                    Enter a title to search and select files to download.
                  </p>
                </mdui-card>
              )}

              {filteredResults.length > 0 && (
                <mdui-card variant="elevated" className="results-table-card">
                  <div className="results-table-scroll">
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th>Release</th>
                          <th>Quality</th>
                          <th>Size</th>
                          <th>Seeds</th>
                          <th style={{ textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredResults.map((item) => {
                          const isAdded = Boolean(addedIds[item.id]);
                          return (
                            <tr key={item.id}>
                              <td style={{ minWidth: "260px", maxWidth: "500px" }}>
                                <div
                                  style={{
                                    fontWeight: 600,
                                    fontSize: "0.92rem",
                                    marginBottom: "2px",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {item.clean_name || item.title}
                                </div>
                                <div
                                  className="mono"
                                  style={{
                                    fontSize: "0.72rem",
                                    color: "rgb(var(--mdui-color-on-surface-variant))",
                                    wordBreak: "break-all",
                                  }}
                                >
                                  {item.title}
                                </div>
                              </td>
                              <td className="num-cell">
                                <mdui-chip variant="assist">{item.quality || "Unknown"}</mdui-chip>
                              </td>
                              <td className="num-cell">{item.size}</td>
                              <td
                                className="num-cell"
                                style={{
                                  fontWeight: 600,
                                  color: "rgb(var(--mdui-color-primary))",
                                }}
                              >
                                {item.seeders}
                              </td>
                              <td className="num-cell" style={{ textAlign: "right" }}>
                                <div
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                >
                                  <mdui-button-icon
                                    icon="content_copy"
                                    title="Copy magnet URI"
                                    onClick={() => handleCopyMagnet(item)}
                                  />
                                  <mdui-button-icon
                                    variant={isAdded ? "tonal" : "filled"}
                                    icon={isAdded ? "check" : "download"}
                                    title={isAdded ? "Queued in qBittorrent" : "Select files & download"}
                                    onClick={() => openFilePickerForDownload(item)}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </mdui-card>
              )}
            </section>
          )}

          {/* ==================== DOWNLOADS TAB ==================== */}
          {tab === "downloads" && (
            <section>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginBottom: "14px",
                }}
              >
                <h1 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0 }}>
                  Downloads
                </h1>

                <mdui-button variant="tonal" icon="refresh" onClick={loadTorrents}>
                  Refresh
                </mdui-button>
              </div>

              {torrentsError && (
                <mdui-card variant="outlined" className="item-card" style={{ marginBottom: "16px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: "2px" }}>
                        qBittorrent Not Connected
                      </div>
                      <div
                        style={{
                          fontSize: "0.82rem",
                          color: "rgb(var(--mdui-color-on-surface-variant))",
                        }}
                      >
                        {torrentsError}
                      </div>
                    </div>
                    <mdui-button variant="filled" icon="settings" onClick={() => setTab("settings")}>
                      Settings
                    </mdui-button>
                  </div>
                </mdui-card>
              )}

              {transfer && (
                <div className="stat-grid">
                  <div className="stat-card">
                    <span className="stat-label">Download</span>
                    <span className="stat-value" style={{ color: "rgb(var(--mdui-color-primary))" }}>
                      {formatSpeed(transfer.dl_info_speed)}
                    </span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Upload</span>
                    <span className="stat-value">{formatSpeed(transfer.up_info_speed)}</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Active / Total</span>
                    <span className="stat-value">
                      {activeDownloadCount} / {torrents.length}
                    </span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Downloaded</span>
                    <span className="stat-value">{formatBytes(transfer.dl_info_data)}</span>
                  </div>
                </div>
              )}

              {!torrentsError && torrents.length === 0 && (
                <mdui-card
                  variant="filled"
                  className="item-card"
                  style={{ textAlign: "center", padding: "32px 20px" }}
                >
                  <mdui-icon name="inbox" style={{ fontSize: "36px", opacity: 0.7 }} />
                  <h3 style={{ margin: "8px 0 4px", fontSize: "1rem" }}>No Torrents</h3>
                  <p
                    style={{
                      margin: "0 0 12px",
                      fontSize: "0.86rem",
                      color: "rgb(var(--mdui-color-on-surface-variant))",
                    }}
                  >
                    Queued downloads will appear here.
                  </p>
                  <mdui-button variant="tonal" icon="search" onClick={() => setTab("search")}>
                    Search
                  </mdui-button>
                </mdui-card>
              )}

              <div className="torrents-list">
                {torrents.map((t) => {
                  const pct = Math.min(100, Math.max(0, t.progress * 100));
                  const paused = isTorrentPaused(t.state);
                  const stateLabel = formatStateLabel(t.state);
                  const isBusy = busyHash === t.hash;

                  return (
                    <mdui-card key={t.hash} variant="elevated" className="item-card">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: "12px",
                          marginBottom: "8px",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: "0.94rem",
                              wordBreak: "break-word",
                              marginBottom: "4px",
                            }}
                          >
                            {t.name}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              flexWrap: "wrap",
                              fontSize: "0.78rem",
                              color: "rgb(var(--mdui-color-on-surface-variant))",
                            }}
                          >
                            <span>{stateLabel}</span>
                            <span>•</span>
                            <span>{pct.toFixed(1)}%</span>
                            <span>•</span>
                            <span>
                              {formatBytes(t.downloaded)} / {formatBytes(t.size)}
                            </span>
                            <span>•</span>
                            <span>↓ {formatSpeed(t.dlspeed)}</span>
                            <span>↑ {formatSpeed(t.upspeed)}</span>
                            <span>•</span>
                            <span>ETA {formatEta(t.eta)}</span>
                            <span>•</span>
                            <span>
                              {t.num_seeds}S / {t.num_leechs}P
                            </span>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                          <mdui-button-icon
                            icon={paused ? "play_arrow" : "pause"}
                            title={paused ? "Resume" : "Pause / Stop seeding"}
                            disabled={isBusy}
                            onClick={() =>
                              handleTorrentAction(paused ? "resume" : "pause", t.hash)
                            }
                          />
                          <mdui-button-icon
                            icon="delete_outline"
                            title="Delete torrent & files from disk"
                            disabled={isBusy}
                            onClick={() => setDeleteTarget(t)}
                          />
                        </div>
                      </div>

                      <mdui-linear-progress value={t.progress} />
                    </mdui-card>
                  );
                })}
              </div>
            </section>
          )}

          {/* ==================== SETTINGS TAB ==================== */}
          {tab === "settings" && (
            <section style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <h1 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0 }}>
                Settings
              </h1>

              {/* Group 1: Download Client (Collapsible) */}
              <div className="settings-group">
                <div className="settings-group-header">
                  <mdui-icon name="dns" style={{ fontSize: "15px" }} />
                  <span>Downloader</span>
                </div>

                <mdui-card variant="elevated" className="item-card">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setQbitCardOpen((v) => !v)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setQbitCardOpen((v) => !v);
                      }
                    }}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "10px",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <mdui-icon name="cloud_queue" style={{ fontSize: "20px" }} />
                      <div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>qBittorrent</div>
                        <div
                          style={{
                            fontSize: "0.78rem",
                            color: "rgb(var(--mdui-color-on-surface-variant))",
                          }}
                        >
                          {qbitStatus?.url || "http://127.0.0.1:8085"}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <mdui-chip
                        variant="assist"
                        icon={qbitStatus?.connected ? "check_circle" : "error_outline"}
                      >
                        {qbitStatus?.connected
                          ? `${qbitStatus.version || "Connected"}`
                          : "Disconnected"}
                      </mdui-chip>
                      <mdui-button-icon
                        type="button"
                        icon={qbitCardOpen ? "expand_less" : "expand_more"}
                        title={qbitCardOpen ? "Collapse" : "Expand"}
                      />
                    </div>
                  </div>

                  {qbitCardOpen && (
                    <form
                      onSubmit={handleConnectQbit}
                      autoComplete="on"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        marginTop: "14px",
                        paddingTop: "14px",
                        borderTop: "1px solid rgba(var(--mdui-color-outline-variant), 0.35)",
                      }}
                    >
                      <div className="md-field-group">
                        <label htmlFor="qbit-url" className="md-field-label">
                          WebUI URL
                        </label>
                        <div className="md-field-box" style={{ height: "42px" }}>
                          <mdui-icon name="dns" style={{ fontSize: "18px", opacity: 0.7 }} />
                          <input
                            id="qbit-url"
                            name="qbit_url"
                            type="url"
                            autoComplete="url"
                            required
                            className="md-field-input"
                            value={qbitUrl}
                            onChange={(e) => setQbitUrl(e.target.value)}
                          />
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                          gap: "12px",
                        }}
                      >
                        <div className="md-field-group">
                          <label htmlFor="qbit-username" className="md-field-label">
                            Username
                          </label>
                          <div className="md-field-box" style={{ height: "42px" }}>
                            <mdui-icon name="person" style={{ fontSize: "18px", opacity: 0.7 }} />
                            <input
                              id="qbit-username"
                              name="qbit_username"
                              type="text"
                              autoComplete="username"
                              className="md-field-input"
                              value={qbitUser}
                              onChange={(e) => setQbitUser(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="md-field-group">
                          <label htmlFor="qbit-password" className="md-field-label">
                            Password
                          </label>
                          <div className="md-field-box" style={{ height: "42px" }}>
                            <mdui-icon name="key" style={{ fontSize: "18px", opacity: 0.7 }} />
                            <input
                              id="qbit-password"
                              name="qbit_password"
                              type="password"
                              autoComplete="current-password"
                              placeholder="Enter password"
                              className="md-field-input"
                              value={qbitPass}
                              onChange={(e) => setQbitPass(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      {qbitStatus?.error && !qbitStatus.connected && (
                        <div
                          style={{
                            fontSize: "0.82rem",
                            color: "rgb(var(--mdui-color-error))",
                          }}
                        >
                          {qbitStatus.error}
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <mdui-button
                          type="submit"
                          variant="filled"
                          icon="link"
                          loading={connectingQbit}
                          disabled={connectingQbit}
                        >
                          Connect & Save
                        </mdui-button>
                      </div>
                    </form>
                  )}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      marginTop: "14px",
                      paddingTop: "12px",
                      borderTop: "1px solid rgba(var(--mdui-color-outline-variant), 0.35)",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.92rem", fontWeight: 600 }}>
                        Stop seeding after download
                      </div>
                      <div
                        style={{
                          fontSize: "0.76rem",
                          color: "rgb(var(--mdui-color-on-surface-variant))",
                        }}
                      >
                        Automatically pause torrents once 100% downloaded
                      </div>
                    </div>
                    <mdui-switch
                      checked={stopSeeding}
                      disabled={savingSeeding}
                      onClick={handleToggleStopSeeding}
                    />
                  </div>
                </mdui-card>
              </div>

              {/* Group 2: Account & Security (Collapsible) */}
              <div className="settings-group">
                <div className="settings-group-header">
                  <mdui-icon name="admin_panel_settings" style={{ fontSize: "15px" }} />
                  <span>Account</span>
                </div>

                <mdui-card variant="elevated" className="item-card">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setAccountCardOpen((v) => !v)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setAccountCardOpen((v) => !v);
                      }
                    }}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "10px",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <mdui-icon name="person_outline" style={{ fontSize: "20px" }} />
                      <div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                          Login & Password
                        </div>
                        <div
                          style={{
                            fontSize: "0.78rem",
                            color: "rgb(var(--mdui-color-on-surface-variant))",
                          }}
                        >
                          Signed in as {currentUsername}
                        </div>
                      </div>
                    </div>

                    <mdui-button-icon
                      type="button"
                      icon={accountCardOpen ? "expand_less" : "expand_more"}
                      title={accountCardOpen ? "Collapse" : "Expand"}
                    />
                  </div>

                  {accountCardOpen && (
                    <form
                      onSubmit={handleUpdateAccount}
                      autoComplete="on"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        marginTop: "14px",
                        paddingTop: "14px",
                        borderTop: "1px solid rgba(var(--mdui-color-outline-variant), 0.35)",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                          gap: "12px",
                        }}
                      >
                        <div className="md-field-group">
                          <label htmlFor="account-username" className="md-field-label">
                            Username
                          </label>
                          <div className="md-field-box" style={{ height: "42px" }}>
                            <mdui-icon name="badge" style={{ fontSize: "18px", opacity: 0.7 }} />
                            <input
                              id="account-username"
                              name="username"
                              type="text"
                              autoComplete="username"
                              required
                              className="md-field-input"
                              value={accountUsername}
                              onChange={(e) => setAccountUsername(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="md-field-group">
                          <label htmlFor="account-current-pass" className="md-field-label">
                            Current Password
                          </label>
                          <div className="md-field-box" style={{ height: "42px" }}>
                            <mdui-icon name="lock" style={{ fontSize: "18px", opacity: 0.7 }} />
                            <input
                              id="account-current-pass"
                              name="current_password"
                              type="password"
                              autoComplete="current-password"
                              placeholder="Confirm current password"
                              required
                              className="md-field-input"
                              value={accountCurrentPass}
                              onChange={(e) => setAccountCurrentPass(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                          gap: "12px",
                        }}
                      >
                        <div className="md-field-group">
                          <label htmlFor="account-new-pass" className="md-field-label">
                            New Password
                          </label>
                          <div className="md-field-box" style={{ height: "42px" }}>
                            <mdui-icon name="password" style={{ fontSize: "18px", opacity: 0.7 }} />
                            <input
                              id="account-new-pass"
                              name="new_password"
                              type="password"
                              autoComplete="new-password"
                              placeholder="Optional"
                              className="md-field-input"
                              value={accountNewPass}
                              onChange={(e) => setAccountNewPass(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="md-field-group">
                          <label htmlFor="account-confirm-pass" className="md-field-label">
                            Confirm Password
                          </label>
                          <div className="md-field-box" style={{ height: "42px" }}>
                            <mdui-icon name="lock_reset" style={{ fontSize: "18px", opacity: 0.7 }} />
                            <input
                              id="account-confirm-pass"
                              name="confirm_password"
                              type="password"
                              autoComplete="new-password"
                              placeholder="Repeat new password"
                              className="md-field-input"
                              value={accountConfirmPass}
                              onChange={(e) => setAccountConfirmPass(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      {accountError && (
                        <div
                          style={{
                            fontSize: "0.82rem",
                            color: "rgb(var(--mdui-color-error))",
                          }}
                        >
                          {accountError}
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <mdui-button
                          type="submit"
                          variant="filled"
                          icon="save"
                          loading={savingAccount}
                          disabled={savingAccount}
                        >
                          Save
                        </mdui-button>
                      </div>
                    </form>
                  )}
                </mdui-card>
              </div>

              {/* Group 3: Preferences */}
              <div className="settings-group">
                <div className="settings-group-header">
                  <mdui-icon name="tune" style={{ fontSize: "15px" }} />
                  <span>Preferences</span>
                </div>

                <mdui-card variant="elevated" className="item-card">
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontSize: "0.92rem", fontWeight: 600 }}>Theme</span>
                      <mdui-segmented-button-group selects="single" value={themeMode}>
                        {(["auto", "light", "dark"] as ThemeMode[]).map((mode) => (
                          <mdui-segmented-button
                            key={mode}
                            value={mode}
                            onClick={() => applyTheme(mode)}
                          >
                            {mode[0].toUpperCase() + mode.slice(1)}
                          </mdui-segmented-button>
                        ))}
                      </mdui-segmented-button-group>
                    </div>

                    <mdui-divider />

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "0.92rem", fontWeight: 600 }}>Safe Search</div>
                        <div
                          style={{
                            fontSize: "0.76rem",
                            color: "rgb(var(--mdui-color-on-surface-variant))",
                          }}
                        >
                          Block 18+ content by default
                        </div>
                      </div>
                      <mdui-switch
                        checked={safeSearch}
                        onClick={() => setSafeSearch((v) => !v)}
                      />
                    </div>
                  </div>
                </mdui-card>
              </div>
            </section>
          )}
        </div>
      </mdui-layout-main>

      {/* Select Files Before Downloading Dialog */}
      <mdui-dialog
        ref={(el: HTMLElement | null) => {
          fileDialogRef.current = el;
        }}
        open={Boolean(filePickerItem)}
        headline="Select files to download"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: "300px" }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 600, wordBreak: "break-word" }}>
            {filePickerItem?.clean_name || filePickerItem?.title}
          </div>

          {filePickerLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px 0" }}>
              <mdui-linear-progress />
              <span
                style={{
                  fontSize: "0.82rem",
                  color: "rgb(var(--mdui-color-on-surface-variant))",
                }}
              >
                Fetching file list from torrent metadata...
              </span>
            </div>
          )}

          {!filePickerLoading && filePickerFiles.length > 0 && (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.8rem",
                }}
              >
                <span>
                  {selectedFileIds.size} of {filePickerFiles.length} selected (
                  {formatBytes(selectedFilesTotalBytes)})
                </span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <mdui-button
                    variant="text"
                    onClick={() =>
                      setSelectedFileIds(new Set(filePickerFiles.map((f) => f.index)))
                    }
                  >
                    All
                  </mdui-button>
                  <mdui-button variant="text" onClick={() => setSelectedFileIds(new Set())}>
                    None
                  </mdui-button>
                </div>
              </div>

              <div className="file-picker-list">
                {filePickerFiles.map((file) => {
                  const checked = selectedFileIds.has(file.index);
                  return (
                    <label
                      key={file.index}
                      className="file-row"
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedFileIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(file.index)) {
                            next.delete(file.index);
                          } else {
                            next.add(file.index);
                          }
                          return next;
                        });
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                        <mdui-checkbox checked={checked} />
                        <span
                          style={{
                            fontSize: "0.84rem",
                            wordBreak: "break-word",
                          }}
                        >
                          {file.name}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: "0.78rem",
                          color: "rgb(var(--mdui-color-on-surface-variant))",
                          flexShrink: 0,
                        }}
                      >
                        {formatBytes(file.size)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          {filePickerError && (
            <div
              style={{
                fontSize: "0.82rem",
                color: "rgb(var(--mdui-color-on-surface-variant))",
              }}
            >
              {filePickerError}
            </div>
          )}

          {!filePickerLoading && (
            <mdui-checkbox
              checked={stopSeeding}
              onClick={() => setStopSeeding((v) => !v)}
            >
              Stop seeding after download completes
            </mdui-checkbox>
          )}
        </div>

        <mdui-button slot="action" variant="text" onClick={handleCancelFilePicker}>
          Cancel
        </mdui-button>
        <mdui-button
          slot="action"
          variant="filled"
          loading={confirmingDownload}
          disabled={
            filePickerLoading ||
            confirmingDownload ||
            (filePickerFiles.length > 0 && selectedFileIds.size === 0)
          }
          onClick={handleConfirmFilePicker}
        >
          {filePickerFiles.length > 0 ? "Download Selected" : "Download All"}
        </mdui-button>
      </mdui-dialog>

      {/* Delete Torrent & Files Confirmation Dialog */}
      <mdui-dialog
        ref={(el: HTMLElement | null) => {
          dialogRef.current = el;
        }}
        open={Boolean(deleteTarget)}
        icon="delete_forever"
        headline="Delete torrent and files?"
        description="This removes the torrent from qBittorrent and deletes its downloaded files from disk."
      >
        <div style={{ fontSize: "0.88rem", fontWeight: 500, wordBreak: "break-word" }}>
          {deleteTarget?.name}
        </div>
        <mdui-button slot="action" variant="text" onClick={() => setDeleteTarget(null)}>
          Cancel
        </mdui-button>
        <mdui-button
          slot="action"
          variant="filled"
          onClick={async () => {
            const target = deleteTarget;
            setDeleteTarget(null);
            if (target) {
              await handleTorrentAction("deleteFiles", target.hash);
              notify("Deleted torrent and files from disk");
            }
          }}
        >
          Delete
        </mdui-button>
      </mdui-dialog>

      {/* Sign Out Confirmation Dialog */}
      <mdui-dialog
        ref={(el: HTMLElement | null) => {
          logoutDialogRef.current = el;
        }}
        open={logoutConfirmOpen}
        icon="logout"
        headline="Sign out of Jellypull?"
        description={`You are currently signed in as ${currentUsername}.`}
      >
        <mdui-button slot="action" variant="text" onClick={() => setLogoutConfirmOpen(false)}>
          Cancel
        </mdui-button>
        <mdui-button slot="action" variant="filled" onClick={handleLogout}>
          Sign out
        </mdui-button>
      </mdui-dialog>

      {/* Material 3 Snackbar */}
      <mdui-snackbar
        ref={(el: HTMLElement | null) => {
          snackbarRef.current = el;
        }}
        closeable
      >
        {snackMsg}
      </mdui-snackbar>
    </mdui-layout>
  );
}
