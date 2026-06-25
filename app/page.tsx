"use client";
import { useEffect, useState } from "react";

const MODEL = "claude-sonnet-4-6";

interface TgMsg {
  id: string;
  ts: number;
  text: string;
}
interface Overview {
  notes: number;
  projects: number;
  phase: string;
  ctx: number;
  activity: string[];
  runs: number;
  telegram: TgMsg[];
}

function ago(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export default function OverviewPage() {
  const [d, setD] = useState<Overview>({ notes: 0, projects: 0, phase: "—", ctx: 0, activity: [], runs: 0, telegram: [] });

  useEffect(() => {
    let alive = true;
    const j = (p: Promise<Response>) => p.then((r) => r.json()).catch(() => ({}));
    const load = async () => {
      const [notes, seed, paul, log, state] = await Promise.all([
        j(fetch("/api/notes")),
        j(fetch("/api/seed")),
        j(fetch("/api/paul/status")),
        j(fetch("/api/log")),
        j(fetch("/api/state")),
      ]);
      if (!alive) return;
      const st = paul?.state || {};
      const tg: TgMsg[] = (state?.messages || [])
        .filter((m: { source?: string }) => m.source === "telegram")
        .slice(-8)
        .reverse()
        .map((m: { id: string; ts: number; text: string }) => ({ id: m.id, ts: m.ts, text: m.text }));
      setD({
        notes: notes?.count ?? notes?.files?.length ?? 0,
        projects: seed?.projects?.length ?? 0,
        phase: String(st.current_phase ?? "—"),
        ctx: typeof st.context_pct === "number" ? st.context_pct : 0,
        activity: (log?.lines || []).slice(0, 6),
        runs: state?.runs?.length ?? 0,
        telegram: tg,
      });
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const ctxColor = d.ctx > 85 ? "var(--red)" : d.ctx >= 70 ? "var(--yellow)" : "var(--green)";

  return (
    <div className="page">
      <header className="page-header">
        <span className="page-title">
          <span aria-hidden>🛰️</span> Mission Control
        </span>
        <div className="page-header-actions">
          <span className="tag">{MODEL}</span>
        </div>
      </header>

      <div className="page-body" style={{ padding: 24 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Status strip */}
          <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span className="dot dot--pulse" style={{ background: "var(--green)", color: "var(--green)", width: 9, height: 9 }} />
            <span style={{ fontWeight: 600 }}>Agent OS online</span>
            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
              · {MODEL} · PAUL phase {d.phase}
            </span>
            <span className="tag" style={{ marginLeft: "auto", color: "var(--gold)", borderColor: "rgba(255,215,0,0.3)" }}>
              HERMES
            </span>
          </div>

          {/* Metric cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <Metric label="Notes" value={d.notes} />
            <Metric label="Projects" value={d.projects} />
            <Metric label="PAUL phase" value={d.phase} />
            <Metric label="Context" value={`${d.ctx}%`} color={ctxColor} />
          </div>

          {/* Panels */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            <section className="card" style={{ padding: 18 }}>
              <div className="panel-title" style={{ marginBottom: 12 }}>Activity Feed</div>
              {d.activity.length === 0 && <div className="empty" style={{ padding: 16 }}>No recent activity.</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {d.activity.map((line, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, fontSize: 13 }}>
                    <span className="dot" style={{ background: "var(--accent)", color: "var(--accent)", marginTop: 6 }} />
                    <span style={{ color: "var(--text-secondary)", wordBreak: "break-word" }}>{line}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card" style={{ padding: 18 }}>
              <div className="panel-title" style={{ marginBottom: 12 }}>Security Posture</div>
              <Row label="Auth" value="Password gate" ok />
              <Row label="Transport" value="HTTPS tunnel" ok />
              <Row label="Approval mode" value="not enforced" />
              <Row label="Active runs" value={String(d.runs)} />
            </section>
          </div>

          {/* Telegram bridge feed */}
          <section className="card" style={{ padding: 18 }}>
            <div className="panel-title" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden>📡</span> Telegram
              <span
                className="dot"
                style={{ background: d.telegram.length ? "var(--green)" : "var(--text-muted)", color: "var(--green)", marginLeft: 4 }}
              />
            </div>
            {d.telegram.length === 0 ? (
              <div className="empty" style={{ padding: 16 }}>
                No messages yet. Once the bot is bridged, inbound Telegram messages appear here live.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {d.telegram.map((m) => (
                  <div key={m.id} style={{ display: "flex", gap: 10, fontSize: 13, alignItems: "baseline" }}>
                    <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 30 }}>{ago(m.ts)}</span>
                    <span style={{ color: "var(--text-secondary)", wordBreak: "break-word" }}>{m.text}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: 24, fontWeight: 600, color: color || "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ color: ok ? "var(--green)" : "var(--text-secondary)" }}>{value}</span>
    </div>
  );
}
