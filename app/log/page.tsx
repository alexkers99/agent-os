"use client";
import { useEffect, useState } from "react";

interface Entry {
  raw: string;
  date?: string;
  phase?: string;
  text: string;
}

// Parse a history line generously: pull an ISO/bracket timestamp and a [Phase N] tag if present.
function parseLine(raw: string): Entry {
  let text = raw;
  let date: string | undefined;
  let phase: string | undefined;

  const iso = raw.match(/\b(\d{4}-\d{2}-\d{2}[ T][\d:.]+Z?)\b/);
  if (iso) {
    date = iso[1];
    text = text.replace(iso[1], "").trim();
  }
  const ph = raw.match(/\[(Phase[^\]]*)\]/i);
  if (ph) {
    phase = ph[1];
    text = text.replace(ph[0], "").trim();
  }
  text = text.replace(/^[-–|:]\s*/, "").trim();
  return { raw, date, phase, text: text || raw };
}

function fmt(d?: string) {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleString();
}

export default function LogPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/log")
      .then((r) => r.json())
      .then((d) => setEntries((d.lines || []).map(parseLine)))
      .catch(() => setEntries([]))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className="page">
      <header className="page-header">
        <span className="page-title">
          <span aria-hidden>📋</span> Activity Log
        </span>
      </header>

      <div className="page-body" style={{ padding: 24 }}>
        <div className="timeline">
          {loaded && entries.length === 0 && <div className="empty">No activity recorded yet.</div>}
          {entries.map((e, i) => (
            <div className="tl-item" key={i}>
              <div className="tl-rail">
                <span className="dot" style={{ background: "var(--accent)", color: "var(--accent)", marginTop: 4 }} />
                {i < entries.length - 1 && <span className="tl-line" />}
              </div>
              <div className="tl-body">
                <div className="tl-meta">
                  {e.date && <span>{fmt(e.date)}</span>}
                  {e.phase && <span className="badge badge--info">{e.phase}</span>}
                </div>
                <div style={{ fontSize: 14 }}>{e.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
