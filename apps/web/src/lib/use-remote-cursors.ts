"use client";

import { useCallback, useEffect, useState } from "react";
import type { EditorView } from "@tiptap/pm/view";
import type { BlockNoteEditor } from "@blocknote/core";

type RemoteSelection = {
  userId: string;
  name: string;
  picture: string | null;
  color: string;
  from: number;
  to: number;
};

export type ComputedCursor = {
  userId: string;
  name: string;
  picture: string | null;
  color: string;
  /** Unique key for React rendering (userId + optional line index). */
  key: string;
  /** A caret (collapsed selection) when true, a range when false. */
  collapsed: boolean;
  /** Overlay-relative pixel coordinates. */
  left: number;
  top: number;
  width: number;
  height: number;
};

type UseRemoteCursorsOptions = {
  editor: BlockNoteEditor | null;
  remoteSelections?: RemoteSelection[];
  onCursorChange?: (from: number, to: number) => void;
};

function getPMView(editor: BlockNoteEditor | null): EditorView | null {
  if (!editor) return null;
  try {
    return editor.prosemirrorView ?? null;
  } catch {
    return null;
  }
}

function clamp(n: number, min: number, max: number) {
  if (n < min) return min;
  if (n > max) return max;
  return n;
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
 * Tracks remote selections and reports the local user's selection.
 *
 * Returns:
 * - `overlayRef`: callback ref to attach to a `position: relative` parent
 *   that wraps the editor. The hook applies the necessary positioning and
 *   pointer-events styles itself, so the consumer only needs to attach the
 *   ref and render `cursors` inside.
 * - `cursors`: computed positions for each remote cursor in overlay-relative
 *   coordinates, intended to be rendered as animated React elements.
 */
export function useRemoteCursors({
  editor,
  remoteSelections = [],
  onCursorChange,
}: UseRemoteCursorsOptions) {
  const [overlay, setOverlay] = useState<HTMLDivElement | null>(null);
  const [view, setView] = useState<EditorView | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);
  const [cursors, setCursors] = useState<ComputedCursor[]>([]);

  // Capture the ProseMirror view as soon as it's available.
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

  // Callback ref: apply baseline overlay styles when the node mounts so the
  // consumer doesn't have to remember them.
  const overlayRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      node.style.cssText =
        "position:absolute;inset:0;pointer-events:none;z-index:10;overflow:hidden";
    }
    setOverlay(node);
  }, []);

  // Outgoing local selection via BlockNote's public selection-change event.
  // Gated on `view.hasFocus()` so we don't broadcast while typing in the title.
  useEffect(() => {
    if (!editor || !onCursorChange) return;

    let lastFrom = -1;
    let lastTo = -1;

    const fire = () => {
      const v = getPMView(editor);
      if (!v || !v.hasFocus()) return;
      const { from, to } = v.state.selection;
      if (from === lastFrom && to === lastTo) return;
      lastFrom = from;
      lastTo = to;
      onCursorChange(from, to);
    };

    return editor.onSelectionChange(fire, false);
  }, [editor, onCursorChange]);

  // Re-position remote cursors whenever the document changes.
  useEffect(() => {
    if (!editor) return;
    return editor.onChange(() => {
      setLayoutTick((n) => n + 1);
    });
  }, [editor]);

  // Re-position on scroll / resize.
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

  // Recompute cursor positions whenever any input changes.
  useEffect(() => {
    if (!overlay || !view) {
      setCursors([]);
      return;
    }
    if (remoteSelections.length === 0) {
      setCursors((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const overlayRect = overlay.getBoundingClientRect();
    const docSize = view.state.doc.content.size;
    const next: ComputedCursor[] = [];

    for (const sel of remoteSelections) {
      const from = clamp(sel.from, 0, docSize);
      const to = clamp(sel.to, 0, docSize);
      const name = sel.name || "Anonymous";
      const color = sel.color || "#7c3aed";

      if (from === to) {
        try {
          const fc = view.coordsAtPos(from);
          next.push({
            userId: sel.userId,
            name,
            picture: sel.picture,
            color,
            key: sel.userId,
            collapsed: true,
            left: fc.left - overlayRect.left,
            top: fc.top - overlayRect.top,
            width: 2,
            height: Math.max(12, fc.bottom - fc.top),
          });
        } catch {
          continue;
        }
        continue;
      }

      // Non-collapsed selection: compute per-line rectangles.
      const start = Math.min(from, to);
      const end = Math.max(from, to);
      const doc = view.state.doc;

      let pos = start;
      let lineIdx = 0;

      while (pos < end && lineIdx < 500) {
        const resolved = doc.resolve(pos);
        const lineEnd = resolved.end();

        if (lineEnd <= pos) {
          pos = lineEnd + 1;
          continue;
        }

        const segEnd = Math.min(end, lineEnd);
        const segStartPos = pos;
        const segEndPos = segEnd === lineEnd ? lineEnd - 1 : segEnd;

        try {
          const sc = view.coordsAtPos(segStartPos);
          const ec = view.coordsAtPos(segEndPos);

          const left = Math.min(sc.left, ec.left) - overlayRect.left;
          const top = Math.min(sc.top, ec.top) - overlayRect.top;
          const right = Math.max(sc.right, ec.right) - overlayRect.left;
          const bottom = Math.max(sc.bottom, ec.bottom) - overlayRect.top;

          next.push({
            userId: sel.userId,
            name,
            picture: sel.picture,
            color,
            key: `${sel.userId}-${lineIdx}`,
            collapsed: false,
            left,
            top,
            width: Math.max(2, right - left),
            height: Math.max(12, bottom - top),
          });
        } catch {
          // coordsAtPos can fail at node boundaries — skip this line segment.
        }

        pos = lineEnd;
        lineIdx++;
      }
    }

    setCursors(next);
  }, [overlay, view, remoteSelections, layoutTick]);

  return { overlayRef, cursors };
}
