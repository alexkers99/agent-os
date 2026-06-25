export type DotStatus = "idle" | "running" | "done" | "error" | "waiting";

const COLORS: Record<DotStatus, string> = {
  idle: "#666666",
  running: "#3b82f6",
  done: "#22c55e",
  error: "#ef4444",
  waiting: "#eab308",
};

export default function StatusDot({
  status = "idle",
  pulse,
  size = 8,
}: {
  status?: DotStatus;
  pulse?: boolean;
  size?: number;
}) {
  const color = COLORS[status];
  const shouldPulse = pulse ?? status === "running";
  return (
    <span
      className={`dot${shouldPulse ? " dot--pulse" : ""}`}
      style={{ width: size, height: size, background: color, color }}
    />
  );
}
