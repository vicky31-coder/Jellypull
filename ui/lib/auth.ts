import { cookies } from "next/headers";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const SESSION_COOKIE_NAME = "jellypull_ui_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const AUTH_CONFIG_FILE = path.join(DATA_DIR, "auth-config.json");

interface StoredAuthConfig {
  username: string;
  passwordHash: string; // format: scrypt$salt$hex
}

export function getEnvCredentials(): { username: string; password: string } {
  return {
    username: process.env.APP_USERNAME?.trim() || "admin",
    password: process.env.APP_PASSWORD?.trim() || "jellypull",
  };
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function verifyPasswordHash(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hashHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hashHex, "hex");
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

async function readStoredAuth(): Promise<StoredAuthConfig | null> {
  try {
    const raw = await fs.readFile(AUTH_CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<StoredAuthConfig>;
    if (parsed.username && parsed.passwordHash) {
      return {
        username: parsed.username,
        passwordHash: parsed.passwordHash,
      };
    }
  } catch {
    // No custom credentials saved yet; fall back to env
  }
  return null;
}

export async function getActiveUsername(): Promise<string> {
  const stored = await readStoredAuth();
  return stored?.username || getEnvCredentials().username;
}

async function getHmacKey(): Promise<CryptoKey> {
  const { password } = getEnvCredentials();
  const secret =
    process.env.SESSION_SECRET?.trim() ||
    `jellypull-session-key:${password}:v1`;
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function createSessionToken(username: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ u: username, exp }), "utf-8").toString("base64url");
  const key = await getHmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${toHex(sig)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<{ valid: boolean; username?: string }> {
  if (!token) return { valid: false };
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return { valid: false };

  const payload = token.slice(0, dotIdx);
  const sigHex = token.slice(dotIdx + 1);
  if (!payload || !sigHex) return { valid: false };

  try {
    const key = await getHmacKey();
    const expectedSig = toHex(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))
    );
    if (!timingSafeEqualStr(sigHex, expectedSig)) {
      return { valid: false };
    }
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as {
      u?: string;
      exp?: number;
    };
    if (!parsed.u || !parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false };
    }
    return { valid: true, username: parsed.u };
  } catch {
    return { valid: false };
  }
}

export async function validateCredentials(username: string, password: string): Promise<boolean> {
  const stored = await readStoredAuth();
  if (stored) {
    return (
      timingSafeEqualStr(username.trim(), stored.username) &&
      verifyPasswordHash(password, stored.passwordHash)
    );
  }

  const expected = getEnvCredentials();
  return (
    timingSafeEqualStr(username.trim(), expected.username) &&
    timingSafeEqualStr(password, expected.password)
  );
}

export async function verifyCurrentPassword(password: string): Promise<boolean> {
  const stored = await readStoredAuth();
  if (stored) {
    return verifyPasswordHash(password, stored.passwordHash);
  }
  const expected = getEnvCredentials();
  return timingSafeEqualStr(password, expected.password);
}

export async function updateAccountCredentials(opts: {
  currentPassword: string;
  newUsername: string;
  newPassword?: string;
}): Promise<{ username: string; passwordUpdated: boolean }> {
  const ok = await verifyCurrentPassword(opts.currentPassword);
  if (!ok) {
    throw new Error("Current password is incorrect.");
  }

  const trimmedUser = opts.newUsername.trim();
  if (trimmedUser.length < 2) {
    throw new Error("Login username must be at least 2 characters.");
  }

  const nextPassword = opts.newPassword && opts.newPassword.length > 0
    ? opts.newPassword
    : opts.currentPassword;

  if (opts.newPassword && opts.newPassword.length < 4) {
    throw new Error("New password must be at least 4 characters.");
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  const payload: StoredAuthConfig = {
    username: trimmedUser,
    passwordHash: hashPassword(nextPassword),
  };
  await fs.writeFile(AUTH_CONFIG_FILE, JSON.stringify(payload, null, 2), {
    mode: 0o600,
  });

  return {
    username: trimmedUser,
    passwordUpdated: Boolean(opts.newPassword && opts.newPassword.length > 0),
  };
}

export async function getSessionFromCookies(): Promise<{ authenticated: boolean; username?: string }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const verified = await verifySessionToken(token);
  return {
    authenticated: verified.valid,
    username: verified.username,
  };
}
