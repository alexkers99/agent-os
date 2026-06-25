"use client";
import type { AgentProfile, RunState } from "@/lib/types";

export default function AgentRail({
  agents,
  activeId,
  onSelect,
  runs,
}: {
  agents: AgentProfile[];
  activeId: string;
  onSelect: (id: string) => void;
  runs: RunState[];
}) {
  const workers = agents.filter((a) => a.id !== "critic");
  const critic = agents.find((a) => a.id === "critic");
  const runningByAgent = (id: string) => runs.some((r) => r.agentId === id && r.status === "running");

  return (
    <aside className="agent-rail">
      <div className="rail-label">Agents</div>
      <ul className="rail-list">
        {workers.map((a) => (
          <li key={a.id}>
            <button
              className={`agent ${activeId === a.id ? "agent--active" : ""}`}
              onClick={() => onSelect(a.id)}
            >
              <span className="agent-dot" style={{ background: a.accent || "var(--accent)" }} />
              <span className="agent-meta">
                <span className="agent-name">{a.name}</span>
                <span className="agent-role">{a.role}</span>
              </span>
              {runningByAgent(a.id) && <span className="dot-running" />}
            </button>
          </li>
        ))}
      </ul>

      {critic && (
        <>
          <div className="rail-label">Judge</div>
          <div className="agent agent--critic">
            <span className="agent-dot" style={{ background: critic.accent || "var(--error)" }} />
            <span className="agent-meta">
              <span className="agent-name">{critic.name}</span>
              <span className="agent-role">{critic.role}</span>
            </span>
          </div>
        </>
      )}
    </aside>
  );
}
