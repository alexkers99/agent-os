# DESIGN.md

> Quiet luxury for machines that think — a dark, near-silent console where the work is the only thing that glows.

## 1. Visual Theme & Atmosphere

**Style**: Dark Editorial Minimalism ("Quiet Luxury")
**Keywords**: restrained, precise, warm-monochrome, hairline, editorial, engineered, calm, confident
**Tone**: Vercel's engineering precision met with Studio Itsu's editorial calm — NOT neon, NOT cyberpunk, NOT "AI dashboard with glowing gradients"
**Feel**: Like a matte-black instrument panel in a quiet studio at night — every line is intentional, nothing pulses for attention, the only color is the work itself.

**Interaction Tier**: **L1 — Refined Static** (elegant hover, soft entrance, zero scroll-jacking)
**Dependencies**: CSS only. No GSAP, no Lenis, no WebGL. The restraint is the design.

> Why L1: this is a working console, not a marketing page. The "wow" comes from precision typography, hairline structure, and the live agent work — not from motion spectacle. Motion that competes with running agents is clutter.

## 2. Color Palette & Roles

```css
:root {
  /* Backgrounds — warm near-black, layered by elevation */
  --bg: #0a0a0b;                 /* page background */
  --surface: #111012;            /* panels, cards */
  --surface-alt: #0d0d0e;        /* recessed / alternate panels */
  --surface-hover: #17161a;      /* hovered surface */

  /* Borders — hairlines, never solid heavy lines */
  --border: rgba(255, 255, 255, 0.07);
  --border-hover: rgba(255, 255, 255, 0.14);
  --border-strong: rgba(255, 255, 255, 0.20);

  /* Text — warm off-white, never pure #fff */
  --text: #ededec;               /* headings, primary */
  --text-secondary: #a0a0a0;     /* body, descriptions */
  --text-tertiary: #6a6a6e;      /* labels, metadata, muted */

  /* Accent — a single champagne/bone tone, used sparingly */
  --accent: #c8b89a;             /* active agent, links, key focus */
  --accent-hover: #d9cbb1;
  --accent-dim: rgba(200, 184, 154, 0.12);  /* tinted backgrounds */

  /* RGB variants for rgba() */
  --bg-rgb: 10, 10, 11;
  --accent-rgb: 200, 184, 154;
  --text-rgb: 237, 237, 236;

  /* Semantic — desaturated, earthy, never candy */
  --success: #84a98c;            /* critic PASS / done */
  --error: #c08457;             /* critic REJECT / failure (muted clay) */
  --warning: #c9a86a;            /* running / awaiting (amber-champagne) */
  --info: #8aa1b4;              /* telegram / external events (slate-blue) */

  /* Geometry */
  --radius-sm: 6px;
  --radius: 10px;
  --radius-lg: 14px;
  --radius-pill: 9999px;

  /* Motion */
  --ease: cubic-bezier(0.22, 0.61, 0.36, 1);
  --dur: 180ms;
}
```

**Color Rules:**
- All colors are referenced through CSS variables — **zero hardcoded hex** in components.
- **One accent only.** Champagne `--accent` marks the active agent, focus, and primary action. Never decorate with it.
- Semantic colors appear **only** on status (critic verdicts, run state, event source) — never as chrome.
- Depth comes from layered `--surface` tones + hairline borders, never from drop shadows or glows.

## 3. Typography Rules

**Font Stack:** Geist Sans + Geist Mono (Vercel's Geist — shipped via the `geist` npm package, not Google Fonts). Geist Mono is the "machine voice" for agent IDs, tool names, timestamps, code, and terminal output.

```css
/* Loaded in app/layout.tsx via the `geist` package (next/font).
   Fallbacks if package unavailable: */
--font-sans: var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
--font-mono: var(--font-geist-mono), ui-monospace, "SF Mono", "JetBrains Mono", "Menlo", monospace;
```

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|------|------|------|--------|-------------|----------------|
| Display / H1 | Geist Sans | 30px | 600 | 1.1 | -0.03em |
| Section / H2 | Geist Sans | 20px | 600 | 1.2 | -0.02em |
| Panel title / H3 | Geist Sans | 15px | 560 | 1.3 | -0.01em |
| Body | Geist Sans | 14px | 400 | 1.6 | normal |
| Body small | Geist Sans | 13px | 400 | 1.55 | normal |
| Label / eyebrow | Geist Mono | 11px | 500 | 1.3 | 0.08em (UPPERCASE) |
| Metadata | Geist Mono | 12px | 400 | 1.4 | normal |
| Code / terminal | Geist Mono | 12.5px | 400 | 1.55 | normal |

**Typography Rules:**
- Three weights only: **400** (read), **500/560** (UI/labels), **600** (announce). No 700 except never.
- Negative tracking on headings (Geist runs tight), normal on body, positive only on uppercase mono labels.
- **NEVER use**: any serif, any decorative/display font, Comic Sans, system-ui as a primary, emoji as iconography.

**Text Decoration:** Per decision table — restrained dark style → **no gradient text, no text-shadow** anywhere. The accent color is the only emphasis. Headings stay flat warm-white.

## 4. Component Stylings

### Buttons
```css
.btn {
  font: 500 13px/1 var(--font-sans);
  letter-spacing: -0.01em;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--dur) var(--ease),
              border-color var(--dur) var(--ease),
              color var(--dur) var(--ease);
}
.btn:hover { background: var(--surface-hover); border-color: var(--border-hover); color: var(--text); }
.btn:active { background: var(--surface-alt); transform: translateY(0.5px); }
.btn:focus-visible { outline: none; border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Primary — the only filled control */
.btn-primary {
  background: var(--accent); color: #1a160d; border-color: var(--accent);
}
.btn-primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); color: #1a160d; }
.btn-primary:disabled { opacity: 0.45; }
```

### Cards / Panels
```css
.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: border-color var(--dur) var(--ease);
}
.panel:hover { border-color: var(--border-hover); }   /* only interactive cards */
.panel:focus-within { border-color: var(--border-strong); }
```

### Navigation / Top rail
```css
.topbar {
  height: 52px;
  border-bottom: 1px solid var(--border);
  background: rgba(var(--bg-rgb), 0.8);
  backdrop-filter: blur(8px);   /* ≤ 14px per perf rule */
  display: flex; align-items: center; gap: 16px; padding: 0 18px;
}
```

### Links
```css
.link { color: var(--text-secondary); text-decoration: none; transition: color var(--dur) var(--ease); }
.link:hover { color: var(--accent); }
.link:focus-visible { outline: none; color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }
```

### Tags / Badges (status pills)
```css
.badge {
  font: 500 11px/1 var(--font-mono);
  letter-spacing: 0.04em; text-transform: uppercase;
  padding: 3px 8px; border-radius: var(--radius-pill);
  border: 1px solid var(--border); color: var(--text-tertiary); background: transparent;
}
.badge--running { color: var(--warning); border-color: rgba(201,168,106,0.3); }
.badge--pass    { color: var(--success); border-color: rgba(132,169,140,0.3); }
.badge--reject  { color: var(--error);   border-color: rgba(192,132,87,0.3); }
.badge--idle    { color: var(--text-tertiary); }
```

### Input / Composer
```css
.input {
  width: 100%; background: var(--surface-alt); color: var(--text);
  border: 1px solid var(--border); border-radius: var(--radius);
  padding: 12px 14px; font: 400 14px/1.5 var(--font-sans); resize: none;
  transition: border-color var(--dur) var(--ease);
}
.input::placeholder { color: var(--text-tertiary); }
.input:focus { outline: none; border-color: var(--border-strong); }
```

## 5. Layout Principles

**Shell:** three-pane console — left **Agent Rail** (240px), center **Chat / Goal stream** (fluid), right **Workspace / Artifacts** (380px, collapsible). Top bar 52px.

**Container:**
- App is full-viewport (`100dvh`), panes scroll independently.
- Center column readable max-width: 760px, centered within its pane.

**Spacing Scale (8px base):** `4, 8, 12, 16, 18, 24, 32, 48`. Panel padding 16–18px. Message gap 18px.

**Grid:**
```css
.shell {
  display: grid;
  grid-template-columns: 240px 1fr 380px;
  grid-template-rows: 52px 1fr;
  height: 100dvh;
}
.shell[data-workspace="collapsed"] { grid-template-columns: 240px 1fr 0; }
```

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat | no border, `--bg` | page background |
| Hairline | `1px solid var(--border)` | panels, rails, cards (default) |
| Raised | `1px solid var(--border-hover)` | hovered/active panel |
| Focus | `1px solid var(--accent)` + `0 0 0 1px var(--accent)` | focused control |
| Overlay | `--surface` + `1px solid var(--border-strong)` + `0 8px 24px rgba(0,0,0,0.5)` | modals/menus only |

**Philosophy:** depth is structural (layered surfaces + hairlines), not atmospheric. Drop shadows exist **only** on true overlays. No glows on anything, ever.

## 7. Animation & Interaction

**Motion Philosophy:** opacity + transform only, 180ms, one easing curve. Motion confirms a change happened — it never performs.
**Tier:** L1.

### Entrance Animation
```css
@keyframes rise {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.rise { animation: rise var(--dur) var(--ease) both; }
.msg { animation: rise 200ms var(--ease) both; }   /* each new message/artifact */
```

### Running indicator (the one "alive" motion)
```css
@keyframes breathe { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }
.dot-running { width: 6px; height: 6px; border-radius: 50%;
  background: var(--warning); animation: breathe 1.6s var(--ease) infinite; }
```

### Hover & Focus States
```css
/* Every interactive element gets hover + visible focus (see component CSS above). */
*:focus-visible { outline: none; }   /* replaced by per-component accent ring */
```

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  .dot-running { animation: none; opacity: 0.85; }
}
```

## 8. Do's and Don'ts

### Do
- Use hairline borders (`--border`) and layered surfaces for all structure.
- Keep one accent (champagne). Let semantic color appear only on status.
- Use Geist Mono for every machine artifact: agent IDs, tool calls, timestamps, code.
- Let whitespace and typography carry hierarchy — size and tracking, not weight or color.
- Animate only opacity/transform, only to confirm a state change.

### Don't
- ❌ No glowing gradients, neon, or "AI dashboard" purple/cyan.
- ❌ No drop shadows except on true overlays (modals/menus).
- ❌ No hardcoded hex in components — variables only.
- ❌ No pure black (`#000`) or pure white (`#fff`).
- ❌ No font weight 700; no serif or display fonts; no emoji as icons.
- ❌ No scroll-jacking, parallax, WebGL, or entrance animations longer than 220ms.
- ❌ No more than one accent color competing in a single view.
- ❌ No `backdrop-filter` blur above 14px, and never over a large scrolling region.

## 9. Responsive Behavior

**Breakpoints:**
| Name | Width | Key Changes |
|------|-------|-------------|
| Desktop | > 1100px | full three-pane shell |
| Tablet | 720–1100px | workspace collapses to a toggle drawer; rail → 200px |
| Mobile | < 720px | single column; rail + workspace become slide-over sheets; bottom composer |

**Touch Targets:** minimum 44×44px on all controls.
**Collapsing Strategy:** workspace pane is the first to go (drawer), then the agent rail (sheet). Chat stream is never collapsed — it is the spine.

```css
@media (max-width: 1100px) {
  .shell { grid-template-columns: 200px 1fr 0; }
  .workspace { position: fixed; right: 0; top: 52px; bottom: 0; width: 380px;
    transform: translateX(100%); transition: transform var(--dur) var(--ease); z-index: 20; }
  .workspace[data-open="true"] { transform: translateX(0); box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
}
@media (max-width: 720px) {
  .shell { grid-template-columns: 1fr; }
  .agent-rail { position: fixed; left: 0; top: 52px; bottom: 0; width: 240px;
    transform: translateX(-100%); transition: transform var(--dur) var(--ease); z-index: 20; background: var(--surface); }
  .agent-rail[data-open="true"] { transform: translateX(0); }
}
```

---

_Motion effects intentionally minimal (L1). Geist font © Vercel (OFL). This spec governs all UI in the Agent OS console._
