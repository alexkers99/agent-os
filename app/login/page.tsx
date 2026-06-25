"use client";
import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !password) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = "/";
        return;
      }
      setError(true);
    } catch {
      setError(true);
    }
    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <form
        onSubmit={submit}
        className="panel rise"
        style={{ width: "100%", maxWidth: 360, padding: 28, display: "flex", flexDirection: "column", gap: 16 }}
      >
        <div className="brand" style={{ marginBottom: 4 }}>
          <span className="brand-mark" />
          <span className="brand-name">Agent OS</span>
        </div>

        <label className="field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Password</span>
          <input
            className="input"
            type="password"
            value={password}
            autoFocus
            placeholder="Enter password"
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(false);
            }}
          />
        </label>

        {error && <div style={{ fontSize: 13, color: "var(--error)" }}>Wrong password</div>}

        <button className="btn btn-primary" type="submit" disabled={loading || !password}>
          {loading ? "…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
