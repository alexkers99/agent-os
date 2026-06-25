"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Item {
  id: string;
  label: string;
  group: "Navigation" | "Actions";
  icon: string;
  run: () => void | Promise<void>;
}

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items: Item[] = useMemo(
    () => [
      { id: "n-overview", group: "Navigation", icon: "🛰️", label: "Overview", run: () => router.push("/") },
      { id: "n-chat", group: "Navigation", icon: "💬", label: "Chat", run: () => router.push("/chat") },
      { id: "n-memory", group: "Navigation", icon: "🧠", label: "Memory", run: () => router.push("/memory") },
      { id: "n-paul", group: "Navigation", icon: "⚙️", label: "PAUL", run: () => router.push("/paul") },
      { id: "n-seed", group: "Navigation", icon: "🌱", label: "Seed", run: () => router.push("/seed") },
      { id: "n-log", group: "Navigation", icon: "📋", label: "Log", run: () => router.push("/log") },
      { id: "n-settings", group: "Navigation", icon: "⚙️", label: "Settings", run: () => router.push("/settings") },
      { id: "a-note", group: "Actions", icon: "📝", label: "New Note", run: () => router.push("/memory?new=1") },
      { id: "a-project", group: "Actions", icon: "🌱", label: "New Project", run: () => router.push("/seed?new=1") },
      {
        id: "a-advance",
        group: "Actions",
        icon: "⏭",
        label: "Advance Phase",
        run: async () => {
          await fetch("/api/paul/advance", { method: "POST" }).catch(() => {});
          router.push("/paul");
        },
      },
      { id: "a-handoff", group: "Actions", icon: "📤", label: "Generate Handoff", run: () => router.push("/paul") },
    ],
    [router],
  );

  const filtered = useMemo(() => {
    const n = q.toLowerCase().trim();
    return n ? items.filter((it) => it.label.toLowerCase().includes(n)) : items;
  }, [items, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);
  useEffect(() => setActive(0), [q]);

  if (!open) return null;

  const select = (it?: Item) => {
    if (!it) return;
    setOpen(false);
    it.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(filtered[active]);
    }
  };

  let lastGroup = "";
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="palette" onKeyDown={onKeyDown}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Search commands…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="palette-list">
          {filtered.length === 0 && <div className="empty">No matches</div>}
          {filtered.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <div key={it.id}>
                {header && <div className="palette-group">{header}</div>}
                <div
                  className={`palette-item ${i === active ? "palette-item--active" : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(it);
                  }}
                >
                  <span aria-hidden>{it.icon}</span>
                  <span>{it.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
