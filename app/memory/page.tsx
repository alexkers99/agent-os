"use client";
import { useCallback, useEffect, useState } from "react";

export default function MemoryPage() {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBody, setNewBody] = useState("");

  const loadList = useCallback(async () => {
    try {
      const r = await fetch("/api/notes");
      const d = await r.json();
      setFiles(d.files || []);
    } catch {
      setFiles([]);
    }
  }, []);

  useEffect(() => {
    loadList();
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("new")) setCreating(true);
  }, [loadList]);

  const openNote = async (f: string) => {
    setSelected(f);
    setContent("Loading…");
    try {
      const r = await fetch(`/api/notes?file=${encodeURIComponent(f)}`);
      setContent(await r.text());
    } catch {
      setContent("(failed to load)");
    }
  };

  const del = async (f: string) => {
    if (!confirm(`Delete ${f}?`)) return;
    await fetch(`/api/notes?file=${encodeURIComponent(f)}`, { method: "DELETE" });
    if (selected === f) {
      setSelected(null);
      setContent("");
    }
    loadList();
  };

  const create = async () => {
    let name = newName.trim();
    if (!name) return;
    if (!name.toLowerCase().endsWith(".md")) name += ".md";
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: name, content: newBody }),
    });
    setCreating(false);
    setNewName("");
    setNewBody("");
    await loadList();
    openNote(name);
  };

  const shown = files.filter((f) => f.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="page">
      <header className="page-header">
        <span className="page-title">
          <span aria-hidden>🧠</span> Memory
        </span>
        <div className="page-header-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
            + New Note
          </button>
        </div>
      </header>

      <div className="page-body">
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", height: "100%", minHeight: 0 }}>
          {/* List */}
          <div style={{ borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
              <input className="input" placeholder="Search notes…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div style={{ overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
              {shown.length === 0 && <div className="empty">No notes.</div>}
              {shown.map((f) => (
                <div key={f} className={`row ${selected === f ? "row--active" : ""}`} onClick={() => openNote(f)}>
                  <span className="mono" style={{ fontSize: 12.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f}
                  </span>
                  <button
                    className="btn btn-ghost btn-sm btn-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      del(f);
                    }}
                    aria-label="Delete"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Viewer */}
          <div style={{ overflowY: "auto", padding: 20, minHeight: 0 }}>
            {selected ? (
              <>
                <div className="mono" style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>{selected}</div>
                <pre className="codeblock" style={{ maxHeight: "none" }}>{content}</pre>
              </>
            ) : (
              <div className="empty">Select a note to read it.</div>
            )}
          </div>
        </div>
      </div>

      {creating && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setCreating(false)}>
          <div className="modal-card">
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>New Note</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input className="input" placeholder="filename.md" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
              <textarea className="input" rows={8} placeholder="# Note content…" value={newBody} onChange={(e) => setNewBody(e.target.value)} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setCreating(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={create} disabled={!newName.trim()}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
