"use client";
import { useState } from "react";
import type { AgentProfile, Artifact, RunState } from "@/lib/types";

export default function GoalPane({
  agents,
  runs,
  logs,
  artifacts,
  onStart,
  onStop,
  defaultAgent,
  onOpenArtifact,
}: {
  agents: AgentProfile[];
  runs: RunState[];
  logs: Record<string, string[]>;
  artifacts: Artifact[];
  onStart: (goal: string, dod: string, agentId: string) => void;
  onStop: (id: string) => void;
  defaultAgent: string;
  onOpenArtifact: (a: Artifact) => void;
}) {
  const [goal, setGoal] = useState("");
  const [dod, setDod] = useState("");
  const [agentId, setAgentId] = useState(defaultAgent);
  const workers = agents.filter((a) => a.id !== "critic");

  const start = () => {
    if (!goal.trim() || !dod.trim()) return;
    onStart(goal.trim(), dod.trim(), agentId);
    setGoal("");
    setDod("");
  };

  return (
    <div className="pane goal">
      <div className="goal-form panel rise">
        <div className="panel-title">New Goal</div>
        <label className="field">
          <span>Target</span>
          <textarea
            className="input"
            rows={2}
            placeholder="What should the agent achieve?"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Definition of done</span>
          <textarea
            className="input"
            rows={2}
            placeholder="The Critic loops the agent until this is met."
            value={dod}
            onChange={(e) => setDod(e.target.value)}
          />
        </label>
        <div className="goal-actions">
          <select className="input select" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            {workers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={start} disabled={!goal.trim() || !dod.trim()}>
            Run loop
          </button>
        </div>
      </div>

      <div className="runs">
        {runs.length === 0 && (
          <div className="empty">
            No runs yet. Define a <strong>target</strong> and a <strong>definition of done</strong> — the agent works,
            the Critic judges, and it loops until it passes.
          </div>
        )}
        {runs.map((r) => (
          <RunCard
            key={r.id}
            run={r}
            logs={logs[r.id] || []}
            onStop={onStop}
            artifacts={artifacts.filter((a) => a.runId === r.id)}
            onOpenArtifact={onOpenArtifact}
            agentName={agents.find((a) => a.id === r.agentId)?.name || r.agentId}
          />
        ))}
      </div>
    </div>
  );
}

function RunCard({
  run,
  logs,
  onStop,
  artifacts,
  onOpenArtifact,
  agentName,
}: {
  run: RunState;
  logs: string[];
  onStop: (id: string) => void;
  artifacts: Artifact[];
  onOpenArtifact: (a: Artifact) => void;
  agentName: string;
}) {
  const cls =
    run.status === "done" ? "pass" : run.status === "running" ? "running" : run.status === "failed" ? "reject" : "idle";

  return (
    <div className="panel run-card rise">
      <div className="run-head">
        <div className="run-title">{run.goal}</div>
        <span className={`badge badge--${cls}`}>
          {run.status === "running" && <span className="dot-running" />}
          {run.status}
        </span>
      </div>
      <div className="run-meta">
        {agentName} · {run.iterations.length} iteration{run.iterations.length !== 1 ? "s" : ""} ·{" "}
        <span className="mono">{run.id}</span>
      </div>

      <div className="iters">
        {run.iterations.map((it) => (
          <div key={it.n} className="iter">
            <div className="iter-head">
              <span className="mono">#{it.n}</span>
              <span className={`badge badge--${it.verdict.pass ? "pass" : "reject"}`}>
                {it.verdict.pass ? "pass" : "reject"} {it.verdict.score}
              </span>
            </div>
            {it.verdict.feedback && <div className="iter-feedback">{it.verdict.feedback}</div>}
          </div>
        ))}
      </div>

      {run.status === "running" && logs.length > 0 && <div className="run-log mono">{logs[logs.length - 1]}</div>}

      {artifacts.length > 0 && (
        <div className="run-arts">
          {artifacts.map((a) => (
            <button key={a.id} className="art-chip mono" onClick={() => onOpenArtifact(a)}>
              {a.name}
            </button>
          ))}
        </div>
      )}

      {run.error && <div className="run-error mono">{run.error}</div>}
      {run.status === "running" && (
        <button className="btn run-stop" onClick={() => onStop(run.id)}>
          Stop
        </button>
      )}
    </div>
  );
}
