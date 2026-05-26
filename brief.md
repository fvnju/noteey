# Noteey Design Brief

## Overview

**Product**: Noteey — a collaborative note-taking space where teams think together in real time.

**What it is**: A rich text note editor with real-time collaboration, tagging, shareable links, and a command palette. Notes live in Convex; real-time sync runs over WebSocket; auth is Auth0; the UI uses HeroUI v3 + Tailwind v4 + BlockNote for editing.

## Register

**Product-first**. The app (`/app`) is the instrument — people open it daily to write, edit, and collaborate. The landing page (`/`) is a marketing wrapper that introduces the brand voice but should stay lean. Brand tone (warm, quiet, thoughtful) carries into the app through color, type, and motion, not through decorative marketing elements.

## Users & Context

**Primary user**: Small teams and collaborators who read and build on each other's notes in real time. They arrive to work, not to browse. Speed, clarity, and trust in live collaboration are the table stakes.

**State they're in**: Switching between solo thinking and collaborative editing throughout a session. They need to see who else is present, what's changing, and where their attention should go — without the interface competing for it.

## Core Jobs

1. **Operate** — Write and edit rich text. The editor is the canvas. Every toolbar, popover, cursor, and formatting affordance must feel immediate.
2. **Explore** — Search, filter, and navigate across notes. Command palette (`⌘K`), tag system, and note list are the discovery surfaces.
3. **Compare** — See shared notes alongside owned notes. Understand what belongs to whom and what's been shared with you.
4. **Configure** — Manage tags (create, rename, recolor, delete), share notes via codes, and control collaborator access.

## Artifact

The **note** is the domain object. It has a title, rich content (BlockNote JSON blocks), tags (per-user), an owner, collaborators, and a live editing session. Everything in the UI orbits the note — selecting, editing, tagging, sharing, searching.

## Evidence

- Real-time cursors from collaborators prove the note is alive.
- Tag pills on notes prove organization is working.
- The command palette returning results proves the search index is current.
- Connected user avatars prove the collaboration session is active.
- Toast confirmations on save/share/delete prove actions completed.

## Voice

- **Quiet confidence**, not marketing enthusiasm. "Start writing, or type '/' for commands" — not "Supercharge your workflow!"
- **Sentence case everywhere**. No title case labels, no exclamation points.
- **One verb per action**. "Save changes" not "OK". "Delete note" not "Confirm".
- **Labels, not placeholders**. Every input has a visible label. Placeholders show examples or format hints.

## Anti-References

- **Generic SaaS gradients** — no purple-to-cyan, no blue-violet CTAs, no stock geometric hero backgrounds.
- **Notion-style block databases** — Noteey is a focused editor, not a workspace builder. No tables, no kanban, no relational databases inside a note.
- **Dark-terminal aesthetic** — not a developer tool. No monospace-everywhere, no green-on-black.
- **Overdecorated landing pages** — the landing page is lean. No 3D illustrations, no animated counters, no "trusted by X companies" badges.

## Visual Foundation

**Color**:
- Background: warm cream `#fafaf8` (landing), white or near-white (app)
- Text: near-black `#1a1a18` for body, `#6b6b68` for secondary, `#9b9b97` for tertiary
- Accent: amber spectrum — warm, human, not techy. Gradient runs from amber-500 through orange-500.
- Tags use distinct HSL colors (starting with `hsl(222, 84%, 56%)` blue default).
- HeroUI v3 semantic tokens: `primary`, `secondary`, `tertiary`, `danger`, `ghost` — no `solid`/`bordered`/`flat`.

**Typography**:
- Body: Geist (variable, sans-serif) — system legibility with a touch of character
- Code: Geist Mono (variable)
- Landing headings: large scale (6xl–8xl), tight tracking, 1.08 leading
- App UI: HeroUI defaults, with BlockNote controlling editor typography

**Motion**:
- framer-motion (project is already committed to this, not the newer "motion" package)
- Spring-based transitions (stiffness 340, damping 34 for UI)
- LayoutGroup + layoutId for morphing elements (command palette trigger → dialog)
- AnimatePresence for mount/unmount transitions
- Respect `prefers-reduced-motion`

**Surface quality**:
- Landing: subtle backdrop blur on nav, soft card shadows with accent-tinted glow
- App: flat, minimal chrome. One floating bar at the bottom (profile pill, search trigger, connected users). No persistent sidebar or top nav.
- Progressive blur overlay at the bottom edge when content scrolls underneath the floating bar.

## Component Rules

- **Prefer HeroUI v3** over custom primitives. Use semantic variants (`primary`, `secondary`, `tertiary`), not visual ones.
- **MorphingDialog** for modals — no close button inside the dialog. Closes via outside click / Escape.
- **TextShimmer** for loading states, not HeroUI Skeleton.
- **Remote cursor labels** show avatars, not text names.
- **Don't nest Button inside DropdownTrigger** — HeroUI v3 already renders a button.
- **Profile pill** resolves user name/email via the same approach used in the existing `ProfilePill` component, not ad-hoc parsing.
- **State management**: Jotai for shared state across components.

## Accessibility

- WCAG 2.1 AA via React Aria (HeroUI v3 foundation)
- Focus rings visible, 2-3px, offset from element, 3:1 contrast
- Touch targets minimum 44×44px
- Keyboard navigation for command palette, editor, and all interactive surfaces
- Light theme default, dark theme supported via `next-themes`

## Tech Stack Reference

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI Components | HeroUI v3 (`@heroui/react`, `@heroui/styles`) |
| Styling | Tailwind CSS v4 |
| Backend | Convex |
| Auth | Auth0 (`@auth0/nextjs-auth0`) |
| Rich text | BlockNote v0.50 (atop TipTap/ProseMirror) |
| Real-time | Socket.io (custom server in `apps/realtime`) |
| Animation | framer-motion v12 |
| State | Jotai |
| Package manager | Bun |
| Monorepo | Turborepo |

## Composition Lanes

For the app surface, the dominant work patterns are:
- **Operate** — editor canvas, floating toolbar, command palette, inline tag assignment
- **Explore** — command palette search, tag filtering, note list navigation

Avoid collapsing into centered hero layouts or card grids inside the app. The editor is the center. Every secondary surface (tag manager, share dialog, collaborator list) opens as an overlay or popover — never as a page navigation.
