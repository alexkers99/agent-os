"use client";
import type { Artifact } from "@/lib/types";

export default function Workspace({
  open,
  artifacts,
  openArtifact,
  onOpenArtifact,
  onClose,
}: {
  open: boolean;
  artifacts: Artifact[];
  openArtifact: Artifact | null;
  onOpenArtifact: (a: Artifact | null) => void;
  onClose: () => void;
}) {
  return (
    <aside className="workspace" data-open={open}>
      <div className="ws-head">
        <span className="rail-label">Workspace</span>
        <span className="ws-head-right">
          <span className="ws-count mono">{artifacts.length}</span>
          <button className="btn ws-hide" onClick={onClose} title="Hide">
            ×
          </button>
        </span>
      </div>

      {openArtifact ? (
        <div className="ws-viewer">
          <div className="ws-viewer-head">
            <button className="btn ws-back" onClick={() => onOpenArtifact(null)}>
              ← All
            </button>
            <span className="mono ws-name">{openArtifact.name}</span>
          </div>
          <pre className={`ws-content ${openArtifact.kind === "code" ? "is-code" : ""}`}>{openArtifact.content}</pre>
        </div>
      ) : (
        <div className="ws-list">
          {artifacts.length === 0 && (
            <div className="empty small">Artifacts agents generate appear here in real time — code, markdown, docs.</div>
          )}
          {artifacts.map((a) => (
            <button key={a.id} className="ws-item rise" onClick={() => onOpenArtifact(a)}>
              <span className="ws-item-top">
                <span className="ws-item-name mono">{a.name}</span>
                <span className="badge badge--idle">{a.kind}</span>
              </span>
              <span className="ws-item-preview">{a.content.slice(0, 90)}</span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
