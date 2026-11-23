"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OctopusIcon } from "@/components/OctopusIcon";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const resolvedUser = String(formData.get("username") ?? username).trim();
    const resolvedPass = String(formData.get("password") ?? password);

    if (!resolvedUser || !resolvedPass) {
      setError("Enter both username and password.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: resolvedUser, password: resolvedPass }),
      });
      const data = (await res.json()) as { error?: string; authenticated?: boolean };
      if (!res.ok) {
        setError(data.error || "Sign in failed.");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Network error while signing in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background:
          "radial-gradient(circle at 20% 0%, rgba(26, 115, 232, 0.12), transparent 50%), rgb(var(--mdui-color-background))",
      }}
    >
      <mdui-card
        variant="elevated"
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "32px 28px",
          borderRadius: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            marginBottom: "24px",
          }}
        >
          <div className="brand-pill-badge-lg">
            <OctopusIcon size={30} />
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 6px" }}>
            Sign in to Jellypull
          </h1>
          <p
            style={{
              fontSize: "0.88rem",
              color: "rgb(var(--mdui-color-on-surface-variant))",
              margin: 0,
            }}
          >
            Access media search and qBittorrent download control
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          autoComplete="on"
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <div className="md-field-group">
            <label htmlFor="jellypull-username" className="md-field-label">
              Username
            </label>
            <div className="md-field-box">
              <mdui-icon name="person" style={{ fontSize: "20px", opacity: 0.7 }} />
              <input
                id="jellypull-username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="md-field-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="md-field-group">
            <label htmlFor="jellypull-password" className="md-field-label">
              Password
            </label>
            <div className="md-field-box">
              <mdui-icon name="lock" style={{ fontSize: "20px", opacity: 0.7 }} />
              <input
                id="jellypull-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className="md-field-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <mdui-button-icon
                type="button"
                icon={showPassword ? "visibility_off" : "visibility"}
                title={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
              />
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "12px",
                background: "rgb(var(--mdui-color-error-container))",
                color: "rgb(var(--mdui-color-on-error-container))",
                fontSize: "0.85rem",
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          )}

          <mdui-button
            type="submit"
            variant="filled"
            full-width
            loading={loading}
            disabled={loading}
            style={{ marginTop: "4px", height: "44px" }}
          >
            Sign in
          </mdui-button>
        </form>
      </mdui-card>
    </main>
  );
}
