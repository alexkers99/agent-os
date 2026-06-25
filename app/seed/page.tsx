"use client";
import { useCallback, useEffect, useState } from "react";

interface Project {
  slug: string;
  name: string;
}

const EMPTY = { name: "", description: "", stack: "", apis: "", features: "", deployment: "" };

export default function SeedPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [viewing, setViewing] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/seed");
      const d = await r.json();
      setProjects(d.projects || []);
    } catch {
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    load();
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("new")) setCreating(true);
  }, [load]);

  const view = async (slug: string) => {
    setViewing(slug);
    setContent("Loading…");
    try {
      const r = await fetch(`/api/seed?slug=${encodeURIComponent(slug)}`);
      setContent(await r.text());
    } catch {
      setContent("(failed to load)");
    }
  };

  const create = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setCreating(false);
      setForm({ ...EMPTY });
      load();
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="page">
      <header className="page-header">
        <span className="page-title">
          <span aria-hidden>🌱</span> Seed
        </span>
        <div className="page-header-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
            + New
          </button>
        </div>
      </header>

      <div className="page-body" style={{ padding: 24 }}>
        <div className="grid-cards">
          {projects.map((p) => (
            <div key={p.slug} className="proj-card">
              <div style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.slug}</div>
              <button className="btn btn-sm" style={{ marginTop: "auto", alignSelf: "flex-start" }} onClick={() => view(p.slug)}>
                View
              </button>
            </div>
          ))}
          <div className="proj-card proj-card--new" onClick={() => setCreating(true)}>
            <div style={{ fontSize: 24 }}>+</div>
            <div style={{ fontSize: 13 }}>New Project</div>
          </div>
        </div>
      </div>

      {/* View modal */}
      {viewing && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setViewing(null)}>
          <div className="modal-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>{viewing}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setViewing(null)}>
                ✕
              </button>
            </div>
            <pre className="codeblock" style={{ maxHeight: "60vh" }}>{content}</pre>
          </div>
        </div>
      )}

      {/* New project modal */}
      {creating && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setCreating(false)}>
          <div className="modal-card">
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>New Project</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input className="input" placeholder="Name" value={form.name} onChange={set("name")} autoFocus />
              <input className="input" placeholder="Description" value={form.description} onChange={set("description")} />
              <input className="input" placeholder="Tech stack" value={form.stack} onChange={set("stack")} />
              <input className="input" placeholder="APIs / integrations" value={form.apis} onChange={set("apis")} />
              <input className="input" placeholder="MVP features (comma-separated)" value={form.features} onChange={set("features")} />
              <input className="input" placeholder="Deployment target" value={form.deployment} onChange={set("deployment")} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button className="btn btn-ghost" onClick={() => setCreating(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={create} disabled={busy || !form.name.trim()}>
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
