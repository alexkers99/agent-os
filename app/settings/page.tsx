import os from "os";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface PaulState {
  current_phase?: number | string;
  loop_position?: number | string;
}

async function readState(): Promise<PaulState | null> {
  try {
    return JSON.parse(await fs.readFile(path.resolve(process.cwd(), ".paul", "state.json"), "utf8")) as PaulState;
  } catch {
    return null;
  }
}

function fmtUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

export default async function SettingsPage() {
  const model = process.env.HERMES_MODEL || "—";
  const vault = path.resolve(process.env.AGENT_WORKSPACE_DIR || "./workspace", "vault");
  const state = await readState();
  let hostname = "—";
  let uptime = "—";
  try {
    hostname = os.hostname();
    uptime = fmtUptime(os.uptime());
  } catch {
    /* ignore */
  }

  const sections: { title: string; rows: [string, string][] }[] = [
    {
      title: "Model",
      rows: [
        ["App version", "0.1.0"],
        ["Model", model],
      ],
    },
    {
      title: "PAUL",
      rows: [
        ["Current phase", String(state?.current_phase ?? "—")],
        ["Loop position", String(state?.loop_position ?? "—")],
      ],
    },
    {
      title: "Storage",
      rows: [["Vault path", vault]],
    },
    {
      title: "Host",
      rows: [
        ["Hostname", hostname],
        ["Uptime", uptime],
      ],
    },
  ];

  return (
    <div className="page">
      <header className="page-header">
        <span className="page-title">
          <span aria-hidden>⚙️</span> Settings
        </span>
      </header>

      <div className="page-body" style={{ padding: 24 }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {sections.map((s) => (
            <section className="card" key={s.title} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="panel-title">{s.title}</div>
              {s.rows.map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 13 }}>
                  <span style={{ color: "var(--text-muted)" }}>{k}</span>
                  <span className="mono" style={{ color: "var(--text-primary)", textAlign: "right", wordBreak: "break-all" }}>
                    {v}
                  </span>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
