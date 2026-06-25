"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";

interface Msg {
  role: "user" | "assistant";
  content: string;
  ts: number;
}
interface Convo {
  id: string;
  title: string;
  created: string;
  preview: string;
}

const MODEL = "claude-sonnet-4-6";

export default function ChatPage() {
  const [list, setList] = useState<Convo[]>([]);
  const [id, setId] = useState<string>("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const loadList = useCallback(async (): Promise<Convo[]> => {
    try {
      const d = await fetch("/api/history").then((r) => r.json());
      return Array.isArray(d) ? d : d.conversations || [];
    } catch {
      return [];
    }
  }, []);

  const openConvo = useCallback(async (cid: string) => {
    setId(cid);
    try {
      const c = await fetch(`/api/history?id=${encodeURIComponent(cid)}`).then((r) => r.json());
      setMessages(c.messages || []);
    } catch {
      setMessages([]);
    }
  }, []);

  const newChat = useCallback(() => {
    setId(String(Date.now()));
    setMessages([]);
    setText("");
  }, []);

  useEffect(() => {
    (async () => {
      const l = await loadList();
      setList(l);
      if (l.length > 0) openConvo(l[0].id);
      else newChat();
    })();
  }, [loadList, openConvo, newChat]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 144) + "px";
  }, [text]);

  const save = useCallback(
    async (cid: string, msgs: Msg[]) => {
      const title = (msgs.find((m) => m.role === "user")?.content || "New chat").slice(0, 40);
      try {
        await fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: cid, title, messages: msgs }),
        });
        setList(await loadList());
      } catch {
        /* non-fatal */
      }
    },
    [loadList],
  );

  async function send() {
    const t = text.trim();
    if (!t || streaming) return;
    const cid = id || String(Date.now());
    if (!id) setId(cid);
    const next: Msg[] = [...messages, { role: "user", content: t, ts: Date.now() }];
    setMessages([...next, { role: "assistant", content: "", ts: Date.now() }]);
    setText("");
    setStreaming(true);
    let acc = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, agentId: "operator" }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value);
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { ...c[c.length - 1], content: acc };
          return c;
        });
      }
    } catch (e) {
      acc += "\n[error: " + (e as Error).message + "]";
      setMessages((m) => {
        const c = [...m];
        c[c.length - 1] = { ...c[c.length - 1], content: acc };
        return c;
      });
    } finally {
      setStreaming(false);
      save(cid, [...next, { role: "assistant", content: acc, ts: Date.now() }]);
    }
  }

  async function del(cid: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/history?id=${encodeURIComponent(cid)}`, { method: "DELETE" }).catch(() => {});
    const l = await loadList();
    setList(l);
    if (cid === id) {
      if (l.length) openConvo(l[0].id);
      else newChat();
    }
  }

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* History sidebar */}
      <aside style={{ width: 240, flexShrink: 0, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={newChat}>
            + New Chat
          </button>
        </div>
        <div style={{ overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
          {list.length === 0 && <div className="empty" style={{ padding: 16, fontSize: 12 }}>No conversations yet.</div>}
          {list.map((c) => (
            <div
              key={c.id}
              className="row"
              onClick={() => openConvo(c.id)}
              style={{
                borderLeft: c.id === id ? "2px solid var(--accent)" : "2px solid transparent",
                background: c.id === id ? "var(--bg-elevated)" : undefined,
                borderRadius: 0,
                paddingLeft: 10,
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.title || "(untitled)"}
                </span>
                <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtDate(c.created)}</span>
              </span>
              <button className="btn btn-ghost btn-sm" aria-label="Delete" onClick={(e) => del(c.id, e)}>
                ×
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header className="page-header">
          <span className="page-title">
            <span aria-hidden>💬</span> Chat
          </span>
          <div className="page-header-actions">
            <span className="tag">{MODEL}</span>
          </div>
        </header>

        <div className="page-body">
          <div className="chat-stream">
            {messages.length === 0 && (
              <div className="empty">New conversation. The assistant can search and write to your notes vault.</div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`bubble bubble--${m.role === "user" ? "user" : "ai"} rise`}>
                {m.role === "assistant" && <div className="bubble-name">Assistant</div>}
                {m.role === "assistant" ? (
                  <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                ) : (
                  m.content
                )}
                {m.role === "assistant" && streaming && m.content === "" && <span className="caret" />}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        </div>

        <div className="composer">
          <textarea
            ref={taRef}
            className="input"
            rows={1}
            placeholder="Message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button className="btn btn-primary" onClick={send} disabled={streaming || !text.trim()}>
            {streaming ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
