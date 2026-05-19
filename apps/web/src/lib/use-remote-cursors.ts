"use client";

import { useCallback, useEffect, useState } from "react";
import type { EditorView } from "@tiptap/pm/view";
import type { BlockNoteEditor } from "@blocknote/core";

type RemoteSelection = {
  userId: string;
  name: string;
  color: string;
  from: number;
  to: number;
};

type UseRemoteCursorsOptions = {
  editor: BlockNoteEditor | null;
  remoteSelections?: RemoteSelection[];
  onCursorChange?: (from: number, to: number) => void;
};

function getPMView(editor: BlockNoteEditor | null): EditorView | null {
  if (!editor) return null;
  // BlockNote 0.50 exposes the ProseMirror view as a public getter. Guard the
  // access in case the editor isn't fully ready yet.
  try {
    const v = editor.prosemirrorView;
    return v ?? null;
  } catch {
    return null;
  }
}

function clamp(n: number, min: number, max: number) {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let cur: HTMLElement | null = el?.parentElement ?? null;
  while (cur) {
    const style = getComputedStyle(cur);
    if (
      style.overflowY === "auto" ||
      style.overflowY === "scroll" ||
      style.overflowY === "overlay"
    ) {
      return cur;
    }
    cur = cur.parentElement;
  }
  return null;
}

/**
 * Renders remote user cursors/selections as an absolute-positioned overlay on
 * top of the BlockNote editor and (optionally) reports the local user's
 * selection upstream via `onCursorChange`.
 *
 * The overlay element receives a callback ref via the returned `overlayRef`.
 * Place it inside a `position: relative` parent that wraps the editor; the
 * hook will set its position/inset/pointer-events itself.
 */
export function useRemoteCursors({
  editor,
  remoteSelections = [],
  onCursorChange,
}: UseRemoteCursorsOptions) {
  const [overlay, setOverlay] = useState<HTMLDivElement | null>(null);
  const [view, setView] = useState<EditorView | null>(null);
  // Bumped whenever the editor's document changes, the user scrolls, or the
  // window resizes — anything that can change the on-screen position of an
  // existing PM document position. Used to re-run the redraw effect.
  const [layoutTick, setLayoutTick] = useState(0);

  // Capture the ProseMirror view as soon as it's available. The editor may
  // already have one synchronously (on remounts); otherwise wait for onMount.
  useEffect(() => {
    if (!editor) {
      setView(null);
      return;
    }

    const initial = getPMView(editor);
    if (initial) setView(initial);

    const cleanup = editor.onMount(() => {
      const v = getPMView(editor);
      setView(v);
    });

    return () => {
      cleanup?.();
      setView(null);
    };
  }, [editor]);

  // Stable callback ref so the render effect re-fires when the DOM node attaches.
  const overlayRef = useCallback((node: HTMLDivElement | null) => {
    setOverlay(node);
  }, []);

  // Outgoing local selection: use BlockNote's selection-change event so we
  // catch every modality (mouse, keyboard, IME, programmatic) without rolling
  // our own DOM listeners.
  useEffect(() => {
    if (!editor || !onCursorChange) return;

    let lastFrom = -1;
    let lastTo = -1;

    const fire = () => {
      const v = getPMView(editor);
      // Avoid broadcasting our position when the editor isn't focused (e.g.
      // user is typing in the title input).
      if (!v || !v.hasFocus()) return;
      const { from, to } = v.state.selection;
      if (from === lastFrom && to === lastTo) return;
      lastFrom = from;
      lastTo = to;
      onCursorChange(from, to);
    };

    // includeSelectionChangedByRemote=false → we don't echo back our own
    // position when remote updates land.
    return editor.onSelectionChange(fire, false);
  }, [editor, onCursorChange]);

  // Bump the layout tick whenever the editor's document changes so we
  // reposition existing remote cursors against the new layout.
  useEffect(() => {
    if (!editor) return;
    return editor.onChange(() => {
      setLayoutTick((n) => n + 1);
    });
  }, [editor]);

  // Bump on scroll / resize so cursors track the visible text.
  useEffect(() => {
    if (!view) return;
    const tick = () => setLayoutTick((n) => n + 1);
    const scroller = findScrollParent(view.dom);
    scroller?.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    return () => {
      scroller?.removeEventListener("scroll", tick);
      window.removeEventListener("scroll", tick);
      window.removeEventListener("resize", tick);
    };
  }, [view]);

  // Render remote cursors into the overlay element.
  useEffect(() => {
    if (!overlay) return;

    // Apply overlay styles defensively every render — cheap and means the
    // caller doesn't need to know how to style it.
    overlay.style.position = "absolute";
    overlay.style.inset = "0";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "10";
    overlay.style.overflow = "hidden";

    if (!view || remoteSelections.length === 0) {
      overlay.innerHTML = "";
      return;
    }

    const overlayRect = overlay.getBoundingClientRect();
    const docSize = view.state.doc.content.size;
    const parts: string[] = [];

    for (const sel of remoteSelections) {
      const from = clamp(sel.from, 0, docSize);
      const to = clamp(sel.to, 0, docSize);
      let fromCoords: { top: number; bottom: number; left: number; right: number };
      let toCoords: { top: number; bottom: number; left: number; right: number };
      try {
        fromCoords = view.coordsAtPos(from);
        toCoords = from === to ? fromCoords : view.coordsAtPos(to);
      } catch {
        // Position out of range or view not laid out yet — skip this cursor.
        continue;
      }

      const safeName = escapeHtml(sel.name || "Anonymous");
      const color = sel.color || "#7c3aed";

      if (from === to) {
        const left = fromCoords.left - overlayRect.left;
        const top = fromCoords.top - overlayRect.top;
        const height = Math.max(12, fromCoords.bottom - fromCoords.top);
        parts.push(
          `<div style="position:absolute;left:${left}px;top:${top}px;height:${height}px;width:2px;background:${color};">` +
            `<span style="position:absolute;top:-2px;left:0;transform:translateY(-100%);font-size:10px;font-weight:600;line-height:1;padding:2px 5px;border-radius:3px 3px 3px 0;white-space:nowrap;background:${color};color:#fff;">${safeName}</span>` +
            `</div>`,
        );
      } else {
        const left = Math.min(fromCoords.left, toCoords.left) - overlayRect.left;
        const top = Math.min(fromCoords.top, toCoords.top) - overlayRect.top;
        const right =
          Math.max(fromCoords.right, toCoords.right) - overlayRect.left;
        const bottom =
          Math.max(fromCoords.bottom, toCoords.bottom) - overlayRect.top;
        const w = Math.max(2, right - left);
        const h = Math.max(12, bottom - top);
        parts.push(
          `<div style="position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;background:${color}33;border-bottom:2px solid ${color};">` +
            `<span style="position:absolute;top:-2px;left:0;transform:translateY(-100%);font-size:10px;font-weight:600;line-height:1;padding:2px 5px;border-radius:3px 3px 3px 0;white-space:nowrap;background:${color};color:#fff;">${safeName}</span>` +
            `</div>`,
        );
      }
    }

    overlay.innerHTML = parts.join("");
  }, [overlay, view, remoteSelections, layoutTick]);

  return { overlayRef };
}
