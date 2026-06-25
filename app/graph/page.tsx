"use client";
import { useEffect, useRef, useState } from "react";

interface GNode {
  id: string;
  label: string;
  size: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}
interface GEdge {
  source: string;
  target: string;
}

const radiusOf = (n: GNode) => Math.max(6, Math.min(20, 6 + n.size * 2));

export default function GraphPage() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GNode[]>([]);
  const edgesRef = useRef<GEdge[]>([]);
  const dragRef = useRef<{ node: GNode | null; moved: boolean; down: { x: number; y: number } | null }>({ node: null, moved: false, down: null });
  const hoverRef = useRef<string | null>(null);
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const selectedRef = useRef<string | null>(null);
  const fileIndexRef = useRef<Record<string, string>>({});

  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // Index every vault note by basename AND full relative path, so clicking a node for a
  // subdirectory note (e.g. daily/2026-06-25) resolves to the real file instead of 404ing
  // against <basename>.md at the vault root.
  useEffect(() => {
    fetch("/api/notes")
      .then((r) => r.json())
      .then((d: { files?: string[] }) => {
        const idx: Record<string, string> = {};
        for (const f of d.files || []) {
          const noExt = f.replace(/\.md$/i, "");
          idx[noExt] = f;
          const base = noExt.split("/").pop()!;
          if (!(base in idx)) idx[base] = f; // basename → first match wins
        }
        fileIndexRef.current = idx;
      })
      .catch(() => {});
  }, []);

  // Fetch graph data.
  useEffect(() => {
    fetch("/api/graph")
      .then((r) => r.json())
      .then((d: { nodes: { id: string; label: string; size: number }[]; edges: GEdge[] }) => {
        const W = wrapRef.current?.clientWidth || 800;
        const H = wrapRef.current?.clientHeight || 600;
        nodesRef.current = (d.nodes || []).map((n) => ({
          ...n,
          x: W / 2 + (Math.random() - 0.5) * W * 0.7,
          y: H / 2 + (Math.random() - 0.5) * H * 0.7,
          vx: 0,
          vy: 0,
        }));
        edgesRef.current = d.edges || [];
        setEmpty(nodesRef.current.length === 0);
      })
      .catch(() => setEmpty(true));
  }, []);

  // Simulation + canvas + interaction (mounts once; reads live refs).
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    const fit = () => {
      canvas.width = wrap.clientWidth;
      canvas.height = wrap.clientHeight;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);

    const step = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const cy = H / 2;
      const drag = dragRef.current;

      // Repulsion (O(n²) — fine for a personal vault; index it if it ever gets huge) + center gravity.
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (a === drag.node) continue;
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const b = nodes[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 0.01) {
            d2 = 0.01;
            dx = Math.random();
            dy = Math.random();
          }
          const d = Math.sqrt(d2);
          const f = 2200 / d2;
          a.vx += (dx / d) * f;
          a.vy += (dy / d) * f;
        }
        a.vx += (cx - a.x) * 0.0009;
        a.vy += (cy - a.y) * 0.0009;
      }
      // Attraction along edges (spring to rest length).
      for (const e of edges) {
        const s = nodes.find((n) => n.id === e.source);
        const t = nodes.find((n) => n.id === e.target);
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = (d - 90) * 0.012;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        if (s !== drag.node) {
          s.vx += fx;
          s.vy += fy;
        }
        if (t !== drag.node) {
          t.vx -= fx;
          t.vy -= fy;
        }
      }
      // Integrate, damp, clamp to bounds.
      for (const a of nodes) {
        if (a === drag.node) continue;
        a.vx = Math.max(-30, Math.min(30, a.vx * 0.85));
        a.vy = Math.max(-30, Math.min(30, a.vy * 0.85));
        a.x += a.vx;
        a.y += a.vy;
        const r = radiusOf(a);
        a.x = Math.max(r, Math.min(W - r, a.x));
        a.y = Math.max(r + 16, Math.min(H - r - 4, a.y));
      }

      // Draw
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#333333";
      ctx.lineWidth = 1;
      for (const e of edges) {
        const s = nodes.find((n) => n.id === e.source);
        const t = nodes.find((n) => n.id === e.target);
        if (!s || !t) continue;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
      }
      const hover = hoverRef.current;
      for (const a of nodes) {
        const r = radiusOf(a);
        ctx.beginPath();
        ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
        ctx.fillStyle = a.id === hover || a.id === selectedRef.current ? "#FFD700" : "#4DD0E1";
        ctx.fill();
        ctx.fillStyle = "#e8e8e8";
        ctx.font = "11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(a.label, a.x, a.y + r + 12);
      }
      if (hover) {
        const m = mouseRef.current;
        ctx.font = "12px system-ui, sans-serif";
        const w = ctx.measureText(hover).width + 16;
        ctx.fillStyle = "rgba(20,30,28,0.96)";
        ctx.fillRect(m.x + 12, m.y - 11, w, 22);
        ctx.strokeStyle = "#324842";
        ctx.strokeRect(m.x + 12, m.y - 11, w, 22);
        ctx.fillStyle = "#FFF8DC";
        ctx.textAlign = "left";
        ctx.fillText(hover, m.x + 20, m.y + 4);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const toLocal = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    };
    const nodeAt = (x: number, y: number): GNode | null => {
      const nodes = nodesRef.current;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const r = radiusOf(n) + 3;
        if ((x - n.x) ** 2 + (y - n.y) ** 2 <= r * r) return n;
      }
      return null;
    };

    const onDown = (ev: MouseEvent) => {
      const m = toLocal(ev);
      dragRef.current = { node: nodeAt(m.x, m.y), moved: false, down: m };
    };
    const onMove = (ev: MouseEvent) => {
      const m = toLocal(ev);
      mouseRef.current = m;
      const drag = dragRef.current;
      if (drag.node && drag.down) {
        if ((m.x - drag.down.x) ** 2 + (m.y - drag.down.y) ** 2 > 9) drag.moved = true;
        drag.node.x = m.x;
        drag.node.y = m.y;
        drag.node.vx = 0;
        drag.node.vy = 0;
        canvas.style.cursor = "grabbing";
      } else {
        const n = nodeAt(m.x, m.y);
        hoverRef.current = n?.id || null;
        canvas.style.cursor = n ? "pointer" : "default";
      }
    };
    const onUp = () => {
      const drag = dragRef.current;
      if (drag.node && !drag.moved) {
        const nid = drag.node.id;
        setSelected(nid);
        setContent("Loading…");
        const file = fileIndexRef.current[nid] || `${nid}.md`;
        fetch(`/api/notes?file=${encodeURIComponent(file)}`)
          .then((r) => (r.ok ? r.text() : Promise.reject()))
          .then(setContent)
          .catch(() => setContent("(note not found — this is an unresolved link target)"));
      }
      dragRef.current = { node: null, moved: false, down: null };
      canvas.style.cursor = "default";
    };

    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div className="page">
      <header className="page-header">
        <span className="page-title">
          <span aria-hidden>🕸</span> Graph
        </span>
        <div className="page-header-actions">
          <span className="tag">vault links</span>
        </div>
      </header>

      <div className="page-body" style={{ display: "flex", position: "relative", minHeight: 0 }}>
        <div ref={wrapRef} style={{ flex: 1, position: "relative", minWidth: 0, background: "#0a0a0a" }}>
          <canvas ref={canvasRef} style={{ display: "block", position: "absolute", inset: 0 }} />
          {empty && (
            <div className="empty" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              No notes with [[wikilinks]] yet. Link notes in your vault to see the graph.
            </div>
          )}
        </div>

        {selected && (
          <aside style={{ width: 300, flexShrink: 0, borderLeft: "1px solid var(--border)", background: "var(--bg-surface)", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selected}.md
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)} aria-label="Close">
                ×
              </button>
            </div>
            <pre className="codeblock" style={{ flex: 1, margin: 0, border: "none", borderRadius: 0, maxHeight: "none" }}>
              {content}
            </pre>
            <div style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
              <a
                className="btn btn-sm"
                href={`/memory?file=${encodeURIComponent(fileIndexRef.current[selected] || `${selected}.md`)}`}
                style={{ width: "100%" }}
              >
                Open in Memory →
              </a>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
