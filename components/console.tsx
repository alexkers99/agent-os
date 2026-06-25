"use client";
import { useCallback, useEffect, useState } from "react";
import type { AgentProfile, Artifact, ChatMessage, RunState } from "@/lib/types";
import Topbar from "./topbar";
import AgentRail from "./agent-rail";
import ChatPane from "./chat-pane";
import GoalPane from "./goal-pane";
import Workspace from "./workspace";

type Tab = "chat" | "goal";

function shortId() {
  // crypto.randomUUID exists in browsers on localhost/https; fall back just in case.
  return (globalThis.crypto?.randomUUID?.() ?? String(Math.random())).slice(0, 8);
}

export default function Console() {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [runs, setRuns] = useState<Record<string, RunState>>({});
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [activeAgent, setActiveAgent] = useState("operator");
  const [tab, setTab] = useState<Tab>("chat");
  const [wsOpen, setWsOpen] = useState(true);
  const [openArtifact, setOpenArtifact] = useState<Artifact | null>(null);
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);

  // Hydrate initial state.
  useEffect(() => {
    fetch("/api/state")
      .then((r) => r.json())
      .then((s) => {
        setAgents(s.agents || []);
        setMessages(s.messages || []);
        setArtifacts(s.artifacts || []);
        const map: Record<string, RunState> = {};
        (s.runs || []).forEach((r: RunState) => (map[r.id] = r));
        setRuns(map);
      })
      .catch(() => {});
  }, []);

  // Live event stream.
  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      let e: { type: string; data: unknown };
      try {
        e = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (e.type === "message") setMessages((m) => [...m, e.data as ChatMessage]);
      else if (e.type === "artifact")
        setArtifacts((a) => [e.data as Artifact, ...a.filter((x) => x.id !== (e.data as Artifact).id)]);
      else if (e.type === "run") setRuns((r) => ({ ...r, [(e.data as RunState).id]: e.data as RunState }));
      else if (e.type === "log") {
        const d = e.data as { runId: string; line: string };
        setLogs((l) => ({ ...l, [d.runId]: [...(l[d.runId] || []).slice(-40), d.line] }));
      }
    };
    return () => es.close();
  }, []);

  const sendChat = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = { id: shortId(), ts: Date.now(), role: "user", text, source: "web" };
      const assistantId = shortId();
      const history = [...messages, userMsg];
      setMessages((m) => [
        ...m,
        userMsg,
        { id: assistantId, ts: Date.now(), role: "assistant", agentId: activeAgent, text: "", source: "web" },
      ]);
      setStreaming(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, agentId: activeAgent }),
        });
        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = dec.decode(value);
          setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, text: x.text + chunk } : x)));
        }
      } catch (e) {
        setMessages((m) =>
          m.map((x) => (x.id === assistantId ? { ...x, text: x.text + "\n[error: " + (e as Error).message + "]" } : x)),
        );
      } finally {
        setStreaming(false);
      }
    },
    [messages, activeAgent],
  );

  const startGoal = useCallback(async (goal: string, dod: string, agentId: string) => {
    await fetch("/api/goal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", goal, dod, agentId }),
    });
  }, []);

  const stopGoal = useCallback(async (runId: string) => {
    await fetch("/api/goal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop", runId }),
    });
  }, []);

  const runList = Object.values(runs).sort((a, b) => b.createdAt - a.createdAt);
  const runningCount = runList.filter((r) => r.status === "running").length;

  return (
    <div className="shell" data-workspace={wsOpen ? "open" : "collapsed"}>
      <Topbar
        connected={connected}
        runningCount={runningCount}
        wsOpen={wsOpen}
        onToggleWs={() => setWsOpen((v) => !v)}
        tab={tab}
        onTab={setTab}
      />
      <AgentRail agents={agents} activeId={activeAgent} onSelect={setActiveAgent} runs={runList} />
      <main className="center">
        {tab === "chat" ? (
          <ChatPane
            messages={messages}
            agents={agents}
            streaming={streaming}
            onSend={sendChat}
            activeAgent={activeAgent}
          />
        ) : (
          <GoalPane
            agents={agents}
            runs={runList}
            logs={logs}
            artifacts={artifacts}
            onStart={startGoal}
            onStop={stopGoal}
            defaultAgent={activeAgent}
            onOpenArtifact={(a) => {
              setOpenArtifact(a);
              setWsOpen(true);
            }}
          />
        )}
      </main>
      <Workspace
        open={wsOpen}
        artifacts={artifacts}
        openArtifact={openArtifact}
        onOpenArtifact={setOpenArtifact}
        onClose={() => setWsOpen(false)}
      />
    </div>
  );
}
