"use client";
import { useEffect, useRef, useState } from "react";

interface Msg {
  id: string;
  role: "user" | "assistant";
  text: string;
}

function uid() {
  return (globalThis.crypto?.randomUUID?.() ?? String(Math.random())).slice(0, 8);
}

const MODEL = "claude-sonnet-4-6";

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize the textarea up to ~6 lines.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 144) + "px";
  }, [text]);

  async function send() {
    const t = text.trim();
    if (!t || streaming) return;
    const user: Msg = { id: uid(), role: "user", text: t };
    const aId = uid();
    const history = [...messages, user];
    setMessages((m) => [...m, user, { id: aId, role: "assistant", text: "" }]);
    setText("");
    setStreaming(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, agentId: "operator" }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value);
        setMessages((m) => m.map((x) => (x.id === aId ? { ...x, text: x.text + chunk } : x)));
      }
    } catch (e) {
      setMessages((m) => m.map((x) => (x.id === aId ? { ...x, text: x.text + "\n[error: " + (e as Error).message + "]" } : x)));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="page">
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
            <div className="empty">Start a conversation. The assistant can search and write to your notes vault.</div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`bubble bubble--${m.role === "user" ? "user" : "ai"} rise`}>
              {m.role === "assistant" && <div className="bubble-name">Assistant</div>}
              {m.text}
              {m.role === "assistant" && streaming && m.text === "" && <span className="caret" />}
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
  );
}
