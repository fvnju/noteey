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

const SIZE_TRANSITION = {
  type: "tween" as const,
  duration: 0.12,
  ease: "easeOut" as const,
};

const FADE_TRANSITION = {
  type: "tween" as const,
  duration: 0.15,
  ease: "easeOut" as const,
};

/**
 * Renders animated remote-user carets and selections inside a positioned
 * overlay. Position changes spring smoothly between locations; size and
 * opacity tween. Cursors fade in/out as users join/leave the document.
 */
export function RemoteCursorsLayer({ cursors }: RemoteCursorsLayerProps) {
  return (
    <AnimatePresence initial={false}>
      {cursors.map((c) => (
        <motion.div
          key={c.userId}
          initial={{
            opacity: 0,
            x: c.left,
            y: c.top,
            width: c.width,
            height: c.height,
          }}
          animate={{
            opacity: 1,
            x: c.left,
            y: c.top,
            width: c.width,
            height: c.height,
          }}
          exit={{ opacity: 0 }}
          transition={{
            x: POSITION_TRANSITION,
            y: POSITION_TRANSITION,
            width: SIZE_TRANSITION,
            height: SIZE_TRANSITION,
            opacity: FADE_TRANSITION,
          }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
            background: c.collapsed ? c.color : `${c.color}33`,
            borderBottom: c.collapsed ? undefined : `2px solid ${c.color}`,
            borderRadius: c.collapsed ? 1 : 0,
            willChange: "transform, width, height, opacity",
          }}
          aria-hidden="true"
        >
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={FADE_TRANSITION}
            style={{
              position: "absolute",
              top: -2,
              left: 0,
              transform: "translateY(-100%)",
              fontSize: 10,
              fontWeight: 600,
              lineHeight: 1,
              padding: "2px 5px",
              borderRadius: "3px 3px 3px 0",
              whiteSpace: "nowrap",
              background: c.color,
              color: "#fff",
              userSelect: "none",
            }}
          >
            {c.name}
          </motion.span>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
