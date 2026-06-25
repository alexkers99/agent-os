"use client";
import { useEffect, useRef, useState } from "react";
import type { AgentProfile, ChatMessage } from "@/lib/types";

export default function ChatPane({
  messages,
  agents,
  streaming,
  onSend,
  activeAgent,
}: {
  messages: ChatMessage[];
  agents: AgentProfile[];
  streaming: boolean;
  onSend: (t: string) => void;
  activeAgent: string;
}) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const nameFor = (m: ChatMessage) =>
    m.role === "user"
      ? m.source === "telegram"
        ? "Telegram"
        : "You"
      : agents.find((a) => a.id === m.agentId)?.name || "Assistant";

  const submit = () => {
    const t = text.trim();
    if (!t || streaming) return;
    setText("");
    onSend(t);
  };

  const activeName = agents.find((a) => a.id === activeAgent)?.name || "agent";

  return (
    <div className="pane chat">
      <div className="stream">
        {messages.length === 0 && (
          <div className="empty">
            Start a conversation with <strong>{activeName}</strong>. Pick a different agent on the left, or switch to{" "}
            <strong>Goal Mode</strong> to run autonomous loops.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg msg--${m.role}`}>
            <div className="msg-head">
              <span className="msg-name">{nameFor(m)}</span>
              {m.source === "telegram" && <span className="badge badge--info">telegram</span>}
            </div>
            <div className="msg-body">
              {m.text}
              {m.role === "assistant" && streaming && m.text === "" && <span className="caret" />}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="composer">
        <textarea
          className="input"
          rows={1}
          placeholder={`Message ${activeName}…`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button className="btn btn-primary" onClick={submit} disabled={streaming || !text.trim()}>
          {streaming ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
