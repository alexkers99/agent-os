"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export default function VaultPage() {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const didInit = useRef(false);

  const loadList = useCallback(async (): Promise<string[]> => {
    try {
      const d = await fetch("/api/notes").then((r) => r.json());
      return d.files || [];
    } catch {
      return [];
    }
  }, []);

  const open = useCallback(async (name: string) => {
    setSelected(name);
    setContent("Loading…");
    try {
      const text = await fetch(`/api/notes?file=${encodeURIComponent(name)}`).then((r) => r.text());
      setContent(text);
      setSavedContent(text);
    } catch {
      setContent("");
      setSavedContent("");
    }
  }, []);

  // Initial load → auto-select first note.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    (async () => {
      const l = await loadList();
      setFiles(l);
      if (l.length) open(l[0]);
    })();
  }, [loadList, open]);

  const doSave = useCallback(async (name: string, text: string) => {
    setSaving(true);
    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: name, content: text }),
      });
      setSavedContent(text);
    } finally {
      setSaving(false);
    }
  }, []);

  const dirty = selected !== null && content !== savedContent;

  // Debounced auto-save: 2s after the last keystroke.
  useEffect(() => {
    if (!dirty || !selected) return;
    const t = setTimeout(() => doSave(selected, content), 2000);
    return () => clearTimeout(t);
  }, [content, dirty, selected, doSave]);

  const createNote = async () => {
    let name = newName.trim();
    if (!name) return;
    if (!name.toLowerCase().endsWith(".md")) name += ".md";
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: name, content: "" }),
    });
    setCreating(false);
    setNewName("");
    setFiles(await loadList());
    open(name);
  };

  const del = async (name: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm(`Delete ${name}?`)) return;
    await fetch(`/api/notes?file=${encodeURIComponent(name)}`, { method: "DELETE" });
    const l = await loadList();
    setFiles(l);
    if (selected === name) {
      setSelected(null);
      setContent("");
      setSavedContent("");
    }
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!f) return;
    setUploading(true);
    setUploadPct(0);
    setUploadMsg(null);

    const fd = new FormData();
    fd.append("file", f);
    // XHR (not fetch) so we get real upload-progress events — no extra dependency.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/vault/upload");
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setUploadPct(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = async () => {
      setUploading(false);
      try {
        const r = JSON.parse(xhr.responseText) as { success?: boolean; path?: string; error?: string; extracted?: number };
        if (xhr.status >= 200 && xhr.status < 300 && r.success) {
          setUploadMsg({ ok: true, text: `Uploaded → ${r.path}${r.extracted ? ` (${r.extracted} files)` : ""}` });
          setFiles(await loadList());
          if (r.path && r.path.toLowerCase().endsWith(".md")) open(r.path);
        } else {
          setUploadMsg({ ok: false, text: r.error || `Upload failed (HTTP ${xhr.status})` });
        }
      } catch {
        setUploadMsg({ ok: false, text: "Upload failed (bad server response)" });
      }
    };
    xhr.onerror = () => {
      setUploading(false);
      setUploadMsg({ ok: false, text: "Upload failed (network error)" });
    };
    xhr.send(fd);
  };

  const shown = files.filter((f) => f.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Left: file list */}
      <aside style={{ width: 240, flexShrink: 0, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: 12, borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span className="panel-title">Vault</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="badge badge--idle">{files.length}</span>
              <button
                className="btn btn-ghost btn-sm"
                title="Upload .md, .txt, .pdf, .docx, or .zip into the vault"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? `↑ ${uploadPct}%` : "⬆ Upload"}
              </button>
            </span>
          </div>
          <input ref={fileInputRef} type="file" accept=".md,.txt,.pdf,.docx,.zip" style={{ display: "none" }} onChange={onUpload} />
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
            + New Note
          </button>
          {uploading && (
            <div style={{ height: 4, background: "var(--bg-elevated)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${uploadPct}%`, height: "100%", background: "var(--accent)", transition: "width .15s ease" }} />
            </div>
          )}
          {uploadMsg && (
            <div style={{ fontSize: 11.5, lineHeight: 1.4, color: uploadMsg.ok ? "var(--success)" : "var(--error)", wordBreak: "break-word" }}>
              {uploadMsg.text}
            </div>
          )}
          <input className="input" style={{ padding: "8px 10px" }} placeholder="🔍 Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div style={{ overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
          {creating && (
            <input
              className="input"
              style={{ padding: "8px 10px", marginBottom: 4 }}
              placeholder="filename.md"
              value={newName}
              autoFocus
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createNote();
                if (e.key === "Escape") {
                  setCreating(false);
                  setNewName("");
                }
              }}
              onBlur={() => {
                if (!newName.trim()) setCreating(false);
              }}
            />
          )}
          {shown.length === 0 && !creating && <div className="empty" style={{ padding: 16, fontSize: 12 }}>No notes.</div>}
          {shown.map((f) => (
            <div
              key={f}
              className="row"
              onClick={() => open(f)}
              style={{
                borderLeft: selected === f ? "2px solid var(--accent)" : "2px solid transparent",
                background: selected === f ? "var(--bg-elevated)" : undefined,
                borderRadius: 0,
                paddingLeft: 10,
              }}
            >
              <span className="mono" style={{ flex: 1, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f}
              </span>
              <button className="btn btn-ghost btn-sm btn-danger" aria-label="Delete" onClick={(e) => del(f, e)}>
                ×
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Right: editor */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {selected ? (
          <>
            <header className="page-header">
              <span className="page-title" style={{ fontSize: 14 }}>
                <span className="mono" style={{ fontWeight: 500 }}>{selected}</span>
                {dirty && <span className="dot" style={{ background: "var(--warning)", color: "var(--warning)", width: 7, height: 7 }} title="Unsaved changes" />}
              </span>
              <div className="page-header-actions">
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {saving ? "Saving…" : dirty ? "Unsaved" : "Saved"}
                </span>
              </div>
            </header>

            <textarea
              className="mono"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              style={{
                flex: 1,
                width: "100%",
                resize: "none",
                border: "none",
                outline: "none",
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
                padding: 16,
                fontSize: 13,
                lineHeight: 1.6,
              }}
            />

            <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--border)" }}>
              <button className="btn btn-primary" onClick={() => selected && doSave(selected, content)} disabled={saving || !dirty}>
                Save
              </button>
              <button className="btn btn-ghost btn-danger" onClick={() => selected && del(selected)}>
                Delete
              </button>
            </div>
          </>
        ) : (
          <div className="empty" style={{ margin: "auto" }}>← Select a note</div>
        )}
      </div>
    </div>
  );
}
