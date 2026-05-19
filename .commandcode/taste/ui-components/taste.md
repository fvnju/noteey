# UI Components
- For remote cursor labels: render the user's avatar/profile picture instead of their account name text. Confidence: 0.65
- Prefer HeroUI components over @base-ui/react based components for dropdown menus, pills, and other interactive UI patterns. Confidence: 0.65
- HeroUI v3 DropdownTrigger already renders a `<button>` — never nest a Button component inside it; use native elements or an `asChild` pattern for custom trigger content. Confidence: 0.70
- For text shimmer loading effects, use the project's TextShimmer component (apps/web/src/components/text-shimmer.tsx) instead of HeroUI's Skeleton. Confidence: 0.70
- For modal/dialog overlays (like the Manage Tags dialog), use the project's MorphingDialog component (apps/web/src/components/morphing-dialog.tsx) which prevents layout shift by keeping the trigger button in the DOM. Confidence: 0.65
- For MorphingDialog content: do not include any close button or X icon inside the dialog at all. The dialog closes via outside click/Escape. Confidence: 0.70
