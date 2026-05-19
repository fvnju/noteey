"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ComputedCursor } from "@/lib/use-remote-cursors";

type RemoteCursorsLayerProps = {
  cursors: ComputedCursor[];
};

const POSITION_TRANSITION = {
  type: "spring" as const,
  damping: 28,
  stiffness: 320,
  mass: 0.5,
  restDelta: 0.5,
};

const FADE_TRANSITION = {
  type: "tween" as const,
  duration: 0.15,
  ease: "easeOut" as const,
};

/**
 * Renders animated remote-user carets and selection highlights inside a
 * positioned overlay. Position changes spring smoothly between locations.
 * Cursors fade in/out as users join/leave the document. Multi-line
 * selections are split into per-line rectangles so only selected text
 * is highlighted, not the full content block.
 */
export function RemoteCursorsLayer({ cursors }: RemoteCursorsLayerProps) {
  return (
    <AnimatePresence initial={false}>
      {cursors.map((c) => (
        <motion.div
          key={c.key}
          initial={{
            opacity: 0,
            x: c.left,
            y: c.top,
          }}
          animate={{
            opacity: 1,
            x: c.left,
            y: c.top,
          }}
          exit={{ opacity: 0 }}
          transition={{
            x: POSITION_TRANSITION,
            y: POSITION_TRANSITION,
            opacity: FADE_TRANSITION,
          }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: c.collapsed ? 2 : c.width,
            height: c.height,
            pointerEvents: "none",
            background: c.collapsed ? c.color : `${c.color}1f`,
            borderBottom: c.collapsed ? undefined : `2px solid ${c.color}`,
            borderRadius: c.collapsed ? 1 : 0,
            willChange: "transform, opacity",
          }}
          aria-hidden="true"
        >
          {c.collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={FADE_TRANSITION}
              style={{
                position: "absolute",
                top: -18,
                left: 0,
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: `2px solid ${c.color}`,
                overflow: "hidden",
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              {c.picture ? (
                <img
                  src={c.picture}
                  alt={c.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    height: "100%",
                    fontSize: 9,
                    fontWeight: 700,
                    color: c.color,
                    background: `${c.color}1a`,
                  }}
                >
                  {(c.name || "?")[0].toUpperCase()}
                </span>
              )}
            </motion.span>
          )}
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
