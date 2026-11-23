import fs from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";

export interface QbitConfig {
  url: string;
  username: string;
  password: string;
}

export interface QbitTorrent {
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
  save_path: string;
  amount_left: number;
  downloaded: number;
  uploaded: number;
  ratio: number;
}

export interface QbitTransferInfo {
  dl_info_speed: number;
  up_info_speed: number;
  dl_info_data: number;
  up_info_data: number;
  connection_status: string;
}

export interface QbitTorrentFile {
  index: number;
  name: string;
  size: number;
  progress: number;
  priority: number;
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "qbit-config.json");

let cachedSession: { key: string; cookieHeader: string } | null = null;
let failedAuthState: { key: string; message: string } | null = null;

function normalizeUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function base32ToHex(base32: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let hex = "";
  for (const ch of base32.toUpperCase()) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      hex += ((value >>> bits) & 0xff).toString(16).padStart(2, "0");
    }
  }
  return hex.toLowerCase();
}

export function extractInfoHash(magnet: string): string | null {
  const match = magnet.match(/xt=urn:btih:([A-Za-z0-9]+)/i);
  if (!match) return null;
  const raw = match[1];
  if (/^[A-Fa-f0-9]{40}$/.test(raw)) {
    return raw.toLowerCase();
  }
  if (/^[A-Za-z2-7]{32}$/.test(raw)) {
    return base32ToHex(raw);
  }
  return raw.toLowerCase();
}

function rawHttpRequest(
  targetUrl: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
  } = {}
): Promise<{
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const lib = parsed.protocol === "https:" ? https : http;
    const method = (options.method || "GET").toUpperCase();
    const headers: Record<string, string> = { ...(options.headers || {}) };
    if (options.body !== undefined) {
      headers["Content-Length"] = Buffer.byteLength(options.body).toString();
    }

    const req = lib.request(
      parsed,
      {
        method,
        headers,
        timeout: options.timeoutMs ?? 10000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf-8"),
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Request timed out for ${parsed.pathname}`));
    });
    req.on("error", reject);

    if (options.body !== undefined) {
      req.write(options.body);
    }
    req.end();
  });
}

function buildCookieHeader(setCookie: string[] | string | undefined): string {
  if (!setCookie) return "";
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  return list
    .map((entry) => entry.split(";")[0]?.trim())
    .filter((pair) => Boolean(pair && pair.includes("=")))
    .join("; ");
}

export async function loadQbitConfig(): Promise<QbitConfig> {
  try {
    const content = await fs.readFile(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(content) as Partial<QbitConfig>;
    if (parsed.url) {
      return {
        url: normalizeUrl(parsed.url),
        username: parsed.username || "",
        password: parsed.password || "",
      };
    }
  } catch {
    // Fall back to environment defaults
  }

  return {
    url: normalizeUrl(process.env.QBIT_URL || "http://127.0.0.1:8085"),
    username: process.env.QBIT_USERNAME || "",
    password: process.env.QBIT_PASSWORD || "",
  };
}

export async function saveQbitConfig(cfg: QbitConfig): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const normalized: QbitConfig = {
    url: normalizeUrl(cfg.url),
    username: cfg.username.trim(),
    password: cfg.password,
  };
  await fs.writeFile(CONFIG_FILE, JSON.stringify(normalized, null, 2), {
    mode: 0o600,
  });
  cachedSession = null;
}

export async function loginQbit(cfg: QbitConfig, force = false): Promise<string> {
  const baseUrl = normalizeUrl(cfg.url);
  if (!baseUrl) {
    throw new Error("qBittorrent URL is not configured");
  }

  const credKey = `${baseUrl}|${cfg.username}|${cfg.password}`;
  if (!force && failedAuthState?.key === credKey) {
    throw new Error(failedAuthState.message);
  }

  const body = new URLSearchParams({
    username: cfg.username,
    password: cfg.password,
  }).toString();

  const res = await rawHttpRequest(`${baseUrl}/api/v2/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: `${baseUrl}/`,
      Origin: baseUrl,
    },
    body,
    timeoutMs: 8000,
  });

  const text = res.body.trim();
  const cookieHeader = buildCookieHeader(res.headers["set-cookie"]);
  const okStatus = res.status === 200 || res.status === 204;

  if (!okStatus || text === "Fails." || (text !== "Ok." && text !== "")) {
    const msg =
      res.status === 403
        ? text || "qBittorrent temporarily banned login attempts (403)"
        : text && text !== "Fails."
          ? `Unexpected response from qBittorrent login (${res.status}): ${text.slice(0, 120)}`
          : "Invalid qBittorrent username or password";
    failedAuthState = { key: credKey, message: msg };
    throw new Error(msg);
  }

  failedAuthState = null;
  const cacheKey = `${baseUrl}|${cfg.username}`;
  cachedSession = { key: cacheKey, cookieHeader };
  return cookieHeader;
}

async function qbitRequest(
  apiPath: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
  retry = true
): Promise<{ status: number; body: string }> {
  const cfg = await loadQbitConfig();
  const baseUrl = normalizeUrl(cfg.url);
  const cacheKey = `${baseUrl}|${cfg.username}`;

  if (!cfg.username && !cfg.password) {
    throw new Error("qBittorrent credentials are not configured yet");
  }

  if (!cachedSession || cachedSession.key !== cacheKey) {
    await loginQbit(cfg, false);
  }

  const headers: Record<string, string> = {
    ...(options.headers || {}),
    Referer: `${baseUrl}/`,
  };
  if ((options.method || "GET").toUpperCase() !== "GET") {
    headers["Origin"] = baseUrl;
  }
  if (cachedSession?.cookieHeader) {
    headers["Cookie"] = cachedSession.cookieHeader;
  }

  const res = await rawHttpRequest(`${baseUrl}/api/v2${apiPath}`, {
    method: options.method || "GET",
    headers,
    body: options.body,
    timeoutMs: 10000,
  });

  if (res.status === 403 && retry) {
    cachedSession = null;
    await loginQbit(cfg, false);
    return qbitRequest(apiPath, options, false);
  }

  return { status: res.status, body: res.body };
}

export async function testAndSaveQbitConnection(cfg: QbitConfig): Promise<{
  connected: boolean;
  version: string;
  url: string;
  username: string;
}> {
  const normalized: QbitConfig = {
    url: normalizeUrl(cfg.url),
    username: cfg.username.trim(),
    password: cfg.password,
  };

  failedAuthState = null;
  const cookieHeader = await loginQbit(normalized, true);
  const headers: Record<string, string> = {
    Referer: `${normalized.url}/`,
  };
  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }

  const verRes = await rawHttpRequest(`${normalized.url}/api/v2/app/version`, {
    method: "GET",
    headers,
    timeoutMs: 8000,
  });

  if (verRes.status < 200 || verRes.status >= 300) {
    const verBody = verRes.body.trim();
    throw new Error(
      `qBittorrent version check failed (${verRes.status})${verBody ? `: ${verBody}` : ""}`
    );
  }

  const version = verRes.body.trim();
  await saveQbitConfig(normalized);

  return {
    connected: true,
    version,
    url: normalized.url,
    username: normalized.username,
  };
}

export async function getQbitStatus(): Promise<{
  connected: boolean;
  configured: boolean;
  url: string;
  username: string;
  version?: string;
  error?: string;
}> {
  const cfg = await loadQbitConfig();
  const configured = Boolean(cfg.url && (cfg.username || cfg.password));

  if (!configured) {
    try {
      const probe = await rawHttpRequest(`${normalizeUrl(cfg.url)}/api/v2/app/version`, {
        timeoutMs: 4000,
      });
      if (probe.status >= 200 && probe.status < 300) {
        return {
          connected: true,
          configured: true,
          url: cfg.url,
          username: cfg.username,
          version: probe.body.trim(),
        };
      }
    } catch {
      // ignore probe failure
    }
    return {
      connected: false,
      configured: false,
      url: cfg.url,
      username: cfg.username,
    };
  }

  try {
    const res = await qbitRequest("/app/version");
    if (res.status < 200 || res.status >= 300) {
      return {
        connected: false,
        configured,
        url: cfg.url,
        username: cfg.username,
        error: `HTTP ${res.status}`,
      };
    }
    return {
      connected: true,
      configured: true,
      url: cfg.url,
      username: cfg.username,
      version: res.body.trim(),
    };
  } catch (err) {
    return {
      connected: false,
      configured,
      url: cfg.url,
      username: cfg.username,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

export async function applyStopSeedingLimit(hashes: string[]): Promise<void> {
  if (hashes.length === 0) return;
  const body = new URLSearchParams({
    hashes: hashes.join("|"),
    ratioLimit: "0",
    seedingTimeLimit: "0",
    inactiveSeedingTimeLimit: "-1",
    shareLimitAction: "Stop",
  }).toString();

  await qbitRequest("/torrents/setShareLimits", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

export async function getStopSeedingPreference(): Promise<boolean> {
  const res = await qbitRequest("/app/preferences");
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Failed to fetch qBittorrent preferences (${res.status})`);
  }
  const prefs = JSON.parse(res.body) as {
    max_ratio_enabled?: boolean;
    max_ratio?: number;
    max_ratio_act?: number;
  };
  return Boolean(prefs.max_ratio_enabled && prefs.max_ratio === 0 && prefs.max_ratio_act === 0);
}

export async function setStopSeedingPreference(stopSeeding: boolean): Promise<boolean> {
  const payload = stopSeeding
    ? { max_ratio_enabled: true, max_ratio: 0, max_ratio_act: 0 }
    : { max_ratio_enabled: false };

  const body = new URLSearchParams({
    json: JSON.stringify(payload),
  }).toString();

  const res = await qbitRequest("/app/setPreferences", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Failed to update qBittorrent seeding preference (${res.status})`);
  }

  return stopSeeding;
}

export async function addMagnetToQbit(
  magnet: string,
  opts: { category?: string; stopSeeding?: boolean } = {}
): Promise<void> {
  const form = new URLSearchParams();
  form.set("urls", magnet);
  if (opts.category && opts.category.trim()) {
    form.set("category", opts.category.trim());
  }
  if (opts.stopSeeding) {
    form.set("ratioLimit", "0");
    form.set("seedingTimeLimit", "0");
  }

  const res = await qbitRequest("/torrents/add", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const text = res.body.trim();
  if (res.status < 200 || res.status >= 300 || text === "Fails.") {
    throw new Error(`Failed to add torrent to qBittorrent: ${text || res.status}`);
  }

  if (opts.stopSeeding) {
    const hash = extractInfoHash(magnet);
    if (hash) {
      await applyStopSeedingLimit([hash]).catch(() => {});
    }
  }
}

export async function prepareMagnetFiles(magnet: string): Promise<{
  hash: string;
  ready: boolean;
  files: QbitTorrentFile[];
}> {
  const hash = extractInfoHash(magnet);
  if (!hash) {
    throw new Error("Could not extract infohash from magnet URI");
  }

  const form = new URLSearchParams();
  form.set("urls", magnet);
  const addRes = await qbitRequest("/torrents/add", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const addText = addRes.body.trim();
  if (addRes.status < 200 || addRes.status >= 300 || addText === "Fails.") {
    throw new Error(`Failed to load torrent metadata (${addText || addRes.status})`);
  }

  // Ensure torrent is running briefly so DHT/peers deliver metadata, then immediately pause once files arrive
  await performTorrentAction("resume", [hash]).catch(() => {});

  const deadline = Date.now() + 10000;
  let files: QbitTorrentFile[] = [];

  while (Date.now() < deadline) {
    const filesRes = await qbitRequest(`/torrents/files?hash=${encodeURIComponent(hash)}`);
    if (filesRes.status >= 200 && filesRes.status < 300) {
      try {
        const parsed = JSON.parse(filesRes.body) as QbitTorrentFile[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          files = parsed;
          break;
        }
      } catch {
        // still fetching metadata
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  if (files.length > 0) {
    await performTorrentAction("pause", [hash]).catch(() => {});
  }

  return {
    hash,
    ready: files.length > 0,
    files,
  };
}

export async function confirmTorrentSelection(opts: {
  hash: string;
  unselectedIds: number[];
  cancel?: boolean;
  stopSeeding?: boolean;
}): Promise<void> {
  if (opts.cancel) {
    await performTorrentAction("deleteFiles", [opts.hash]);
    return;
  }

  if (opts.unselectedIds.length > 0) {
    const body = new URLSearchParams({
      hash: opts.hash,
      id: opts.unselectedIds.join("|"),
      priority: "0",
    }).toString();

    const prioRes = await qbitRequest("/torrents/filePrio", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (prioRes.status < 200 || prioRes.status >= 300) {
      throw new Error(`Failed to apply file selection (${prioRes.status})`);
    }
  }

  if (opts.stopSeeding) {
    await applyStopSeedingLimit([opts.hash]).catch(() => {});
  }

  await performTorrentAction("resume", [opts.hash]);
}

export async function fetchTorrentsAndStats(): Promise<{
  transfer: QbitTransferInfo;
  torrents: QbitTorrent[];
}> {
  const [torrentsRes, transferRes] = await Promise.all([
    qbitRequest("/torrents/info?sort=added_on&reverse=true"),
    qbitRequest("/transfer/info"),
  ]);

  if (torrentsRes.status < 200 || torrentsRes.status >= 300) {
    throw new Error(`Failed to fetch torrents (${torrentsRes.status})`);
  }
  if (transferRes.status < 200 || transferRes.status >= 300) {
    throw new Error(`Failed to fetch transfer stats (${transferRes.status})`);
  }

  const torrents = JSON.parse(torrentsRes.body) as QbitTorrent[];
  const transfer = JSON.parse(transferRes.body) as QbitTransferInfo;
  return { transfer, torrents };
}

export async function performTorrentAction(
  action: "pause" | "resume" | "delete" | "deleteFiles",
  hashes: string[]
): Promise<void> {
  if (hashes.length === 0) return;
  const hashStr = hashes.join("|");

  if (action === "delete" || action === "deleteFiles") {
    const body = new URLSearchParams({
      hashes: hashStr,
      deleteFiles: action === "deleteFiles" ? "true" : "false",
    }).toString();
    const res = await qbitRequest("/torrents/delete", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Delete failed (${res.status})`);
    }
    return;
  }

  const primary = action === "pause" ? "/torrents/stop" : "/torrents/start";
  const fallback = action === "pause" ? "/torrents/pause" : "/torrents/resume";
  const body = new URLSearchParams({ hashes: hashStr }).toString();

  let res = await qbitRequest(primary, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (res.status === 404) {
    res = await qbitRequest(fallback, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  }

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Torrent ${action} failed (${res.status})`);
  }
}
