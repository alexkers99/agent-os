"use client";
import { useCallback, useEffect, useState } from "react";

interface Phase {
  number?: number;
  name?: string;
  title?: string;
  status?: string;
}
interface PaulState {
  current_phase?: number | string;
  loop_position?: number | string;
  context_pct?: number;
  last_action?: string;
  last_updated?: string;
}
interface StatusData {
  paul?: { phases?: Phase[] };
  state?: PaulState;
}

export default function PaulDashboard() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [busy, setBusy] = useState(false);
  const [unifyOpen, setUnifyOpen] = useState(false);
  const [unifyText, setUnifyText] = useState("");
  const [handoff, setHandoff] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/paul/status");
      if (!r.ok) throw new Error("HTTP " + r.status);
      setStatus(await r.json());
      setError("");
    } catch (e) {
      setError("Couldn't load PAUL status — " + (e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (url: string, body?: unknown) => {
    setBusy(true);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      return await r.json().catch(() => ({}));
    } catch (e) {
      setError((e as Error).message);
      return {};
    } finally {
      setBusy(false);
    }
  };

  const doUnify = async () => {
    if (!unifyText.trim()) return;
    await post("/api/paul/unify", { summary: unifyText.trim() });
    setUnifyText("");
    setUnifyOpen(false);
    load();
  };
  const doAdvance = async () => {
    await post("/api/paul/advance");
    load();
  };
  const doPause = async () => {
    const d = await post("/api/paul/pause");
    if (d?.handoff) setHandoff(d.handoff);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(handoff);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const phases = status?.paul?.phases || [];
  const st = status?.state || {};
  const curNum = typeof st.current_phase === "number" ? st.current_phase : Number(st.current_phase);
  const ctx = typeof st.context_pct === "number" ? st.context_pct : 0;
  const ctxColor = ctx > 85 ? "var(--error)" : ctx >= 70 ? "var(--warning)" : "var(--success)";

  const phaseEmoji = (p: Phase, i: number) => {
    const s = (p.status || "").toLowerCase();
    if (s) {
      if (s.includes("complete") || s.includes("done")) return "✅";
      if (s.includes("progress") || s.includes("active") || s.includes("current")) return "🔄";
      return "⏳";
    }
    const num = p.number ?? i + 1;
    if (!isNaN(curNum)) return num < curNum ? "✅" : num === curNum ? "🔄" : "⏳";
    return "⏳";
  };
  const isCurrent = (p: Phase, i: number) => {
    const num = p.number ?? i + 1;
    return !isNaN(curNum) && num === curNum;
  };

  const fmtDate = (v?: string) => {
    if (!v) return "—";
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toLocaleString();
  };

  return (
    <div style={{ minHeight: "100dvh", overflowY: "auto", padding: "28px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <a className="link" href="/" style={{ fontSize: 13 }}>
          ← Console
        </a>

        <header className="rise">
          <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.03em", margin: 0 }}>PAUL ENGINE</h1>
          <p className="mono" style={{ fontSize: 12, letterSpacing: "0.08em", color: "var(--text-tertiary)", marginTop: 6 }}>
            PLAN · APPLY · UNIFY · LOOP
          </p>
        </header>

        {error && (
          <div className="panel" style={{ padding: 14, color: "var(--error)", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Phase roadmap */}
        <section className="panel rise" style={{ padding: 18 }}>
          <div className="panel-title" style={{ marginBottom: 14 }}>Phase Roadmap</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {phases.length === 0 && <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>No phases reported.</div>}
            {phases.map((p, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: isCurrent(p, i) ? "var(--surface-hover)" : "transparent",
                  border: isCurrent(p, i) ? "1px solid var(--border-hover)" : "1px solid transparent",
                }}
              >
                <span style={{ fontSize: 16, width: 22, textAlign: "center" }}>{phaseEmoji(p, i)}</span>
                <span className="mono" style={{ fontSize: 12, color: "var(--text-tertiary)", width: 18 }}>
                  {p.number ?? i + 1}
                </span>
                <span style={{ fontSize: 14, color: isCurrent(p, i) ? "var(--text)" : "var(--text-secondary)" }}>
                  {p.name ?? p.title ?? "(unnamed)"}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* State panel */}
        <section className="panel rise" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="panel-title">State</div>
          <Row label="Loop" value={String(st.loop_position ?? "—")} mono />
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: "var(--text-tertiary)" }}>Context</span>
              <span className="mono" style={{ color: ctxColor }}>{ctx}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: "var(--surface-alt)", overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, Math.max(0, ctx))}%`, height: "100%", background: ctxColor, transition: "width 200ms var(--ease)" }} />
            </div>
          </div>
          <Row label="Last action" value={st.last_action ?? "—"} />
          <Row label="Last updated" value={fmtDate(st.last_updated)} />
        </section>

        {/* Actions */}
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => setUnifyOpen((v) => !v)} disabled={busy}>
              Unify
            </button>
            <button className="btn" onClick={doAdvance} disabled={busy}>
              Advance Phase
            </button>
            <button className="btn" onClick={doPause} disabled={busy}>
              Pause (Generate Handoff)
            </button>
            <button className="btn" onClick={load} disabled={busy} style={{ marginLeft: "auto" }}>
              Refresh
            </button>
          </div>

          {unifyOpen && (
            <div className="panel rise" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <textarea
                className="input"
                rows={2}
                placeholder="Unify summary…"
                value={unifyText}
                onChange={(e) => setUnifyText(e.target.value)}
                autoFocus
              />
              <button className="btn btn-primary" onClick={doUnify} disabled={busy || !unifyText.trim()} style={{ alignSelf: "flex-start" }}>
                Submit unify
              </button>
            </div>
          )}
        </section>

        {/* Handoff */}
        {handoff && (
          <section className="panel rise" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="panel-title">Handoff</div>
              <button className="btn" onClick={copy} style={{ padding: "4px 10px", fontSize: 12 }}>
                {copied ? "Copied ✓" : "Copy to clipboard"}
              </button>
            </div>
            <pre
              className="mono"
              style={{
                maxHeight: 360,
                overflow: "auto",
                background: "var(--surface-alt)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: 14,
                fontSize: 12.5,
                lineHeight: 1.6,
                color: "var(--text-secondary)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
              }}
            >
              {handoff}
            </pre>
          </section>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 13 }}>
      <span style={{ color: "var(--text-tertiary)" }}>{label}</span>
      <span className={mono ? "mono" : undefined} style={{ color: "var(--text)", textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}
