"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { CSSProperties } from "react";
import type { Doc } from "@noteey/backend/convex/_generated/dataModel";

type TagPillProps = {
  tag: Doc<"tags">;
  isCloseVisible?: boolean;
  onCloseVisibilityStart?: () => void;
  onCloseVisibilityEnd?: () => void;
  onRemoveAction?: () => void;
};

const LEGACY_COLOR_CSS: Record<string, string> = {
  accent: "var(--color-accent)",
  default: "var(--color-default)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
};

const getTagColor = (color: string) => LEGACY_COLOR_CSS[color] ?? color;

export function TagPill({
  tag,
  isCloseVisible = false,
  onCloseVisibilityStart,
  onCloseVisibilityEnd,
  onRemoveAction,
}: TagPillProps) {
  const canRemove = Boolean(onRemoveAction);
  const tagColor = getTagColor(tag.color);
  const style = {
    "--tag-color": tagColor,
  } as CSSProperties;

  return (
    <motion.span
      className="inline-flex h-8 cursor-pointer items-center rounded-full bg-[color-mix(in_srgb,var(--tag-color)_16%,#e1e1e1)] py-0 pl-3 text-[13px] font-normal leading-none text-[#2f2f2f] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--tag-color)_18%,transparent)] dark:bg-[color-mix(in_srgb,var(--tag-color)_22%,#d9d9d9)] dark:text-[#2f2f2f]"
      style={style}
      animate={{ paddingRight: isCloseVisible && canRemove ? 6 : 12 }}
      transition={{ duration: 0.18, ease: "linear" }}
      onMouseEnter={onCloseVisibilityStart}
      onMouseLeave={onCloseVisibilityEnd}
      onFocus={onCloseVisibilityStart}
      onBlur={onCloseVisibilityEnd}
      layout="position"
    >
      <span className="max-w-36 truncate">{tag.name}</span>
      {canRemove && (
        <motion.span
          className="inline-flex shrink-0 overflow-hidden"
          animate={{
            width: isCloseVisible ? 20 : 0,
            marginLeft: isCloseVisible ? 6 : 0,
          }}
          transition={{ duration: 0.18, ease: "linear" }}
        >
          <motion.button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveAction?.();
            }}
            className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--tag-color)_48%,#9a9a9a)] text-white hover:bg-[color-mix(in_srgb,var(--tag-color)_62%,#8f8f8f)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_srgb,var(--tag-color)_48%,#9a9a9a)]"
            animate={{
              x: isCloseVisible ? 0 : -20,
              opacity: isCloseVisible ? 1 : 0,
            }}
            transition={{ duration: 0.18, ease: "linear" }}
            aria-label={`Remove ${tag.name}`}
            tabIndex={isCloseVisible ? 0 : -1}
          >
            <X className="size-3.5 stroke-[2.5]" />
          </motion.button>
        </motion.span>
      )}
    </motion.span>
  );
}
