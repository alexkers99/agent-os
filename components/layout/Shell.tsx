"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import CommandPalette from "../CommandPalette";

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Login renders bare — no sidebar/chrome.
  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">{children}</main>
      <CommandPalette />
    </div>
  );
}
