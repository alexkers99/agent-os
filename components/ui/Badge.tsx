import type { ReactNode } from "react";

export type BadgeColor = "idle" | "running" | "done" | "error" | "info";

export default function Badge({ children, color = "idle" }: { children: ReactNode; color?: BadgeColor }) {
  return <span className={`badge badge--${color}`}>{children}</span>;
}
