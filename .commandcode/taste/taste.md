# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# Rich Text Editing
- For /app: Use BlockNote for the rich text editor. Confidence: 0.50
- For /app: Use HeroUI theme with BlockNote instead of Mantine theme. Confidence: 0.65

# Animation / Motion
- Use framer-motion (import from "framer-motion"), not the newer "motion" package (motion/react), for all animation work — the project already has framer-motion installed. Confidence: 0.65

# State Management
- Use Jotai for shared state across components (e.g., dropdown open/close state consumed by useClickOutside hooks). Confidence: 0.65
- For useClickOutside hooks that depend on Jotai atom values, use a useRef to hold the atom reference rather than reading the atom directly in the handler closure. Confidence: 0.70

# Package Manager
- Use bun as the package manager (e.g., `bun install`, `bun add`). Confidence: 0.50

# UI Components
- Prefer HeroUI components over @base-ui/react based components for dropdown menus, pills, and other interactive UI patterns. Confidence: 0.65
- HeroUI v3 DropdownTrigger already renders a `<button>` — never nest a Button component inside it; use native elements or an `asChild` pattern for custom trigger content. Confidence: 0.70
- For text shimmer loading effects, use the project's TextShimmer component (apps/web/src/components/text-shimmer.tsx) instead of HeroUI's Skeleton. Confidence: 0.70
- For modal/dialog overlays (like the Manage Tags dialog), use the project's MorphingDialog component (apps/web/src/components/morphing-dialog.tsx) which prevents layout shift by keeping the trigger button in the DOM. Confidence: 0.65
- For MorphingDialog content: do not include any close button or X icon inside the dialog at all. The dialog closes via outside click/Escape. Confidence: 0.70

