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

# Heroku Deployment
- Use Procfile for Heroku deployment instead of Docker/container-based approach. Confidence: 0.65

# Docker
- When running TypeScript servers that use native Node addons (e.g., better-sqlite3) in Docker, ensure the base image includes Node.js — Bun-only images (oven/bun:1-slim) lack Node.js which is needed for native addon compatibility and for tools like npx/tsx. Confidence: 0.60

# UI Components
See [ui-components/taste.md](ui-components/taste.md)

# Backend / Convex
- When displaying a user's name in Convex backend queries (e.g., shared notes owner), use the same approach as the profile pill component for name/email resolution rather than ad-hoc user ID parsing. Confidence: 0.65
