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

export default function PaulPage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [busy, setBusy] = useState(false);
  const [unify, setUnify] = useState("");
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
    } finally {
      setBusy(false);
    }
  };

  const doUnify = async () => {
    if (!unify.trim()) return;
    await post("/api/paul/unify", { summary: unify.trim() });
    setUnify("");
    load();
  };
  const doAdvance = async () => {
    const cur = Number(status?.state?.current_phase);
    if (!confirm(`Advance to Phase ${isNaN(cur) ? "next" : cur + 1}?`)) return;
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
    } catch {}
  };

  const phases = status?.paul?.phases || [];
  const st = status?.state || {};
  const curNum = Number(st.current_phase);
  const ctx = typeof st.context_pct === "number" ? st.context_pct : 0;
  const ctxColor = ctx > 85 ? "var(--red)" : ctx >= 70 ? "var(--yellow)" : "var(--green)";

  const phaseKind = (p: Phase, i: number): "done" | "current" | "pending" => {
    const s = (p.status || "").toLowerCase();
    if (s.includes("complete") || s.includes("done")) return "done";
    if (s.includes("progress") || s.includes("active") || s.includes("current")) return "current";
    if (s) return "pending";
    const num = p.number ?? i + 1;
    if (!isNaN(curNum)) return num < curNum ? "done" : num === curNum ? "current" : "pending";
    return "pending";
  };

  const fmtDate = (v?: string) => {
    if (!v) return "—";
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toLocaleString();
  };

  return (
    <div className="page">
      <header className="page-header">
        <span className="page-title">
          <span aria-hidden>⚙️</span> PAUL Engine
        </span>
        <div className="page-header-actions">
          <button className="btn btn-sm" onClick={load} disabled={busy}>
            Refresh
          </button>
        </div>
      </header>

      <div className="page-body" style={{ padding: 24 }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
          {error && <div className="card" style={{ padding: 14, color: "var(--red)" }}>{error}</div>}

          {/* Stepper */}
          <section className="card" style={{ padding: 20 }}>
            <div className="panel-title" style={{ marginBottom: 16 }}>Phase Roadmap</div>
            <div className="stepper" style={{ flexWrap: "wrap", rowGap: 12 }}>
              {phases.length === 0 && <div className="empty" style={{ padding: 8 }}>No phases.</div>}
              {phases.map((p, i) => {
                const kind = phaseKind(p, i);
                return (
                  <div className={`step step--${kind}`} key={i}>
                    {i > 0 && <span className={`step-line ${phaseKind(phases[i - 1], i - 1) === "done" ? "step-line--done" : ""}`} />}
                    <span className="step-dot">{kind === "done" ? "✓" : p.number ?? i + 1}</span>
                    <span style={{ fontSize: 13, color: kind === "current" ? "var(--text-primary)" : "var(--text-muted)", marginRight: 4 }}>
                      {p.name ?? p.title ?? `Phase ${i + 1}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* State */}
          <section className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="panel-title">State</div>
            <Row label="Loop" value={String(st.loop_position ?? "—")} mono />
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: "var(--text-muted)" }}>Context</span>
                <span className="mono" style={{ color: ctxColor }}>{ctx}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: "var(--bg-elevated)", overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, Math.max(0, ctx))}%`, height: "100%", background: ctxColor, transition: "width 200ms var(--ease)" }} />
              </div>
            </div>
            <Row label="Last action" value={st.last_action ?? "—"} />
            <Row label="Last updated" value={fmtDate(st.last_updated)} />
          </section>

          {/* Actions */}
          <section className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="panel-title">Actions</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" placeholder="Unify summary…" value={unify} onChange={(e) => setUnify(e.target.value)} />
              <button className="btn btn-primary" onClick={doUnify} disabled={busy || !unify.trim()}>
                Unify
              </button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={doAdvance} disabled={busy}>
                Advance Phase
              </button>
              <button className="btn" onClick={doPause} disabled={busy}>
                Pause (Generate Handoff)
              </button>
            </div>
          </section>

          {/* Handoff */}
          {handoff && (
            <section className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div className="panel-title">Handoff</div>
                <button className="btn btn-sm" onClick={copy}>
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <pre className="codeblock">{handoff}</pre>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 13 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className={mono ? "mono" : undefined} style={{ color: "var(--text-primary)", textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}
