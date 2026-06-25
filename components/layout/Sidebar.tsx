"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { icon: "🛰️", label: "Overview", href: "/", k: "1" },
  { icon: "💬", label: "Chat", href: "/chat", k: "2" },
  { icon: "🧠", label: "Memory", href: "/memory", k: "3" },
  { icon: "⚙️", label: "PAUL", href: "/paul", k: "4" },
  { icon: "🌱", label: "Seed", href: "/seed", k: "5" },
  { icon: "📋", label: "Log", href: "/log", k: "6" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  // Number-key navigation (1-5), ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const item = NAV.find((n) => n.k === e.key);
      if (item) {
        e.preventDefault();
        router.push(item.href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside className="sidebar">
      <div className="brand-mark" style={{ marginBottom: 10 }} />
      {NAV.map((n) => (
        <button
          key={n.href}
          className={`nav-item ${active(n.href) ? "nav-item--active" : ""}`}
          onClick={() => router.push(n.href)}
          aria-label={n.label}
        >
          <span aria-hidden>{n.icon}</span>
          <span className="nav-tip">
            {n.label}
            <kbd>{n.k}</kbd>
          </span>
        </button>
      ))}
      <div className="sidebar-spacer" />
      <button
        className={`nav-item ${pathname.startsWith("/settings") ? "nav-item--active" : ""}`}
        onClick={() => router.push("/settings")}
        aria-label="Settings"
      >
        <span aria-hidden>⚙️</span>
        <span className="nav-tip">Settings</span>
      </button>
    </aside>
  );
}
