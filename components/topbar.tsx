"use client";

export default function Topbar({
  connected,
  runningCount,
  wsOpen,
  onToggleWs,
  tab,
  onTab,
}: {
  connected: boolean;
  runningCount: number;
  wsOpen: boolean;
  onToggleWs: () => void;
  tab: "chat" | "goal";
  onTab: (t: "chat" | "goal") => void;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" />
        <span className="brand-name">Agent OS</span>
      </div>

      <nav className="tabs">
        <button className={`tab ${tab === "chat" ? "tab--active" : ""}`} onClick={() => onTab("chat")}>
          Chat
        </button>
        <button className={`tab ${tab === "goal" ? "tab--active" : ""}`} onClick={() => onTab("goal")}>
          Goal Mode
        </button>
      </nav>

      <div className="topbar-right">
        {runningCount > 0 && (
          <span className="badge badge--running">
            <span className="dot-running" /> {runningCount} running
          </span>
        )}
        <span className="conn" data-on={connected} title={connected ? "connected" : "disconnected"}>
          <span className="conn-dot" /> {connected ? "live" : "offline"}
        </span>
        <button className="btn" onClick={onToggleWs}>
          {wsOpen ? "Hide workspace" : "Show workspace"}
        </button>
      </div>
    </header>
  );
}
