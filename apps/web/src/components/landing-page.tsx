"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { Button } from "@heroui/react";
import { ArrowRight, Search, Users, Tag } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function useScrollPosition() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return scrolled;
}

function RevealOnScroll({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const timer = setTimeout(() => setVisible(true), delay * 1000);
          observer.unobserve(el);
          return () => clearTimeout(timer);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function EditorMockup({
  className,
  variant = "light",
}: {
  className?: string;
  variant?: "light" | "dark";
}) {
  const isDark = variant === "dark";
  return (
    <div
      className={`overflow-hidden rounded-2xl border shadow-2xl ${className ?? ""}`}
      style={{
        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
        background: isDark ? "#141412" : "#ffffff",
        boxShadow: isDark
          ? "0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)"
          : "0 20px 60px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
      }}
    >
      {/* Window chrome */}
      <div
        className="flex items-center gap-1.5 px-4 py-3"
        style={{ borderBottom: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.05)" }}
      >
        <div className="size-2.5 rounded-full bg-red-400/80" />
        <div className="size-2.5 rounded-full bg-amber-400/80" />
        <div className="size-2.5 rounded-full bg-green-400/80" />
      </div>

      {/* Editor content */}
      <div className="px-8 pt-6 pb-8">
        {/* Title */}
        <div
          className="mb-6 text-2xl font-bold"
          style={{ color: isDark ? "#e8e8e5" : "#1a1a18" }}
        >
          Project roadmap
        </div>

        {/* Tags */}
        <div className="mb-6 flex flex-wrap gap-2">
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background: "color-mix(in srgb, #3b82f6 14%, #e1e1e1)",
              color: "#2f2f2f",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45)",
            }}
          >
            planning
          </span>
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background: "color-mix(in srgb, #f59e0b 14%, #e1e1e1)",
              color: "#2f2f2f",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45)",
            }}
          >
            engineering
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
            style={{
              borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
              background: isDark ? "rgba(255,255,255,0.04)" : "#fafaf8",
              color: isDark ? "#9b9b97" : "#6b6b68",
            }}
          >
            <Tag className="size-3" />
            Manage tags
          </span>
        </div>

        {/* Content blocks */}
        <div className="space-y-3">
          <div
            className="h-3 rounded"
            style={{
              width: "100%",
              background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            }}
          />
          <div
            className="h-3 rounded"
            style={{
              width: "88%",
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
            }}
          />
          <div
            className="h-3 rounded"
            style={{
              width: "64%",
              background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
            }}
          />

          {/* Bullet list */}
          <div className="flex items-center gap-2 pt-1">
            <div
              className="size-1.5 rounded-full"
              style={{ background: isDark ? "rgba(255,255,255,0.2)" : "#9b9b97" }}
            />
            <div
              className="h-2.5 rounded flex-1"
              style={{
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <div
              className="size-1.5 rounded-full"
              style={{ background: isDark ? "rgba(255,255,255,0.2)" : "#9b9b97" }}
            />
            <div
              className="h-2.5 rounded"
              style={{
                width: "72%",
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <div
              className="size-1.5 rounded-full"
              style={{ background: isDark ? "rgba(255,255,255,0.2)" : "#9b9b97" }}
            />
            <div
              className="h-2.5 rounded"
              style={{
                width: "52%",
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
              }}
            />
          </div>
          <div className="h-3" />

          <div
            className="h-3 rounded"
            style={{
              width: "76%",
              background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            }}
          />
          <div
            className="h-3 rounded"
            style={{
              width: "48%",
              background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
            }}
          />
        </div>

        {/* Floating bar — three separate elements, matching the real app */}
        <div className="mt-8 flex items-center gap-3">
          {/* Profile pill */}
          <div
            className="flex items-center gap-2 rounded-full border px-2 py-1.5"
            style={{
              borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
              background: isDark ? "#1a1a18" : "#ffffff",
            }}
          >
            <div className="size-5 rounded-full bg-amber-400/60" />
            <div
              className="h-2.5 rounded w-16"
              style={{
                background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
              }}
            />
            <div className="size-3" style={{ color: "#9b9b97" }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-3">
                <path d="M4 6L8 10L12 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Search trigger — centered */}
          <div
            className="flex flex-1 items-center justify-between gap-2 rounded-full border px-3 py-1"
            style={{
              borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
              background: isDark ? "rgba(255,255,255,0.04)" : "#ffffff",
            }}
          >
            <div className="flex items-center gap-2">
              <Search className="size-3" style={{ color: "#9b9b97" }} />
              <span className="text-xs" style={{ color: "#9b9b97" }}>Search…</span>
            </div>
            <kbd
              className="rounded px-1 py-0.5 font-mono text-[10px] leading-none"
              style={{
                border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
              }}
            >
              ⌘K
            </kbd>
          </div>

          {/* Connected users */}
          <div className="flex -space-x-1.5">
            <div className="size-6 rounded-full border-2 border-white bg-blue-400" />
            <div className="size-6 rounded-full border-2 border-white bg-purple-400" />
            <div className="size-6 rounded-full border-2 border-white bg-amber-400 opacity-40 grayscale" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { user, isLoading } = useUser();
  const scrolled = useScrollPosition();
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    setHeroVisible(true);
  }, []);

  const isLoggedIn = !isLoading && user;

  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#1a1a18] antialiased">
      {/* Nav */}
      <nav
        className={`fixed top-0 z-50 w-full transition-all duration-500 ${
          scrolled
            ? "border-b border-black/5 bg-[#fafaf8]/80 backdrop-blur-xl"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">noteey</span>
          <div>
            {isLoggedIn ? (
              <a
                href="/app"
                className="inline-flex items-center justify-center rounded-full bg-[#1a1a18] px-5 py-2 text-sm font-medium text-white transition-colors duration-300 hover:bg-[#1a1a18]/80"
              >
                App
              </a>
            ) : (
              <a
                href="/auth/login"
                className="inline-flex items-center justify-center rounded-full bg-[#1a1a18] px-5 py-2 text-sm font-medium text-white transition-colors duration-300 hover:bg-[#1a1a18]/80"
              >
                Get started
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-6 pt-32 pb-20">
        <div className="mx-auto max-w-6xl">
          <div
            className={`grid gap-12 items-center lg:grid-cols-2 transition-all duration-1000 ease-out ${
              heroVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
            }`}
          >
            {/* Left: copy */}
            <div className="lg:pr-8">
              <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-[#9b9b97]">
                A note-taking space for collaborators
              </p>
              <h1 className="mb-6 text-5xl font-semibold leading-[1.06] tracking-tight sm:text-6xl lg:text-7xl">
                Your thoughts
                <br />
                deserve their
                <br />
                <span className="text-amber-600">own space.</span>
              </h1>
              <p className="mb-8 max-w-md text-base leading-relaxed text-[#6b6b68]">
                Noteey is a collaborative note editor. Write with your team in
                real time, tag and organize, search everything you&apos;ve ever
                written. No databases, no dashboards — just a clean editor, shared notes, and command-K search.
              </p>
              <div className="flex items-center gap-4">
                {isLoggedIn ? (
                  <a
                    href="/app"
                    className="inline-flex items-center justify-center rounded-full bg-[#1a1a18] px-8 py-3 text-base font-medium text-white transition-all duration-300 hover:bg-[#1a1a18]/80 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/20"
                  >
                    Go to app
                    <ArrowRight className="ml-2 inline h-4 w-4" />
                  </a>
                ) : (
                  <a
                    href="/auth/login?screen_hint=signup"
                    className="inline-flex items-center justify-center rounded-full bg-[#1a1a18] px-8 py-3 text-base font-medium text-white transition-all duration-300 hover:bg-[#1a1a18]/80 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/20"
                  >
                    Start writing free
                    <ArrowRight className="ml-2 inline h-4 w-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Right: editor preview */}
            <EditorMockup className="w-full" />
          </div>
        </div>
      </section>

      {/* Evidence: Write together */}
      <section className="border-y border-black/5 bg-white/40 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <RevealOnScroll>
            <div className="grid gap-12 items-center lg:grid-cols-2">
              {/* Visual: dark editor */}
              <EditorMockup variant="dark" className="w-full order-last lg:order-first" />

              {/* Copy */}
              <div className="lg:pl-12">
                <p className="mb-3 font-mono text-xs uppercase tracking-[0.15em] text-amber-600">
                  Real-time collaboration
                </p>
                <h2 className="mb-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Write together,
                  <br />
                  see every change.
                </h2>
                <p className="max-w-md text-base leading-relaxed text-[#6b6b68]">
                  Share a note with anyone. You&apos;ll see each
                  other&apos;s cursors as you type. Edits land in the same
                  document instantly. No refresh, no reload.
                </p>
                <div className="mt-6 flex items-center gap-3 text-sm text-[#6b6b68]">
                  <Users className="size-4" />
                  <span>Invite via user ID or share link</span>
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* Evidence: Find anything */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <RevealOnScroll>
            <div className="grid gap-12 items-center lg:grid-cols-2">
              {/* Copy */}
              <div>
                <p className="mb-3 font-mono text-xs uppercase tracking-[0.15em] text-amber-600">
                  Command palette
                </p>
                <h2 className="mb-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  ⌘K to find
                  <br />
                  anything, instantly.
                </h2>
                <p className="max-w-md text-base leading-relaxed text-[#6b6b68]">
                  Search across every note you own or have been shared. Filter by
                  tag, scan by title, jump with a keystroke. Your second brain,
                  always awake.
                </p>
                <div className="mt-6 flex items-center gap-3 text-sm text-[#6b6b68]">
                  <Search className="size-4" />
                  <span>Switch notes without leaving the keyboard</span>
                </div>
              </div>

              {/* Visual: command palette preview */}
              <div
                className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-xl"
                style={{ boxShadow: "0 16px 48px rgba(0,0,0,0.06)" }}
              >
                <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
                  <Search className="size-4 text-[#9b9b97]" />
                  <span className="text-sm text-[#9b9b97]">Type a command or search…</span>
                </div>
                <div className="p-2">
                  <div className="px-2 py-1 text-xs font-medium text-[#9b9b97]">My Notes</div>
                  {[
                    { title: "Project roadmap", tags: "planning, engineering" },
                    { title: "Meeting notes — Q3 review", tags: "meetings" },
                    { title: "Design system audit", tags: "design, engineering" },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="flex items-center rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-black/[0.03]"
                    >
                      <span className="truncate flex-1">{item.title}</span>
                      <span className="ml-auto shrink-0 text-xs text-[#9b9b97]">
                        {item.tags}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* Evidence: Stay organized */}
      <section className="border-y border-black/5 bg-white/40 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <RevealOnScroll>
            <div className="grid gap-12 items-center lg:grid-cols-2">
              {/* Visual: tags */}
              <div className="flex flex-wrap gap-3 justify-center order-last lg:order-first">
                {[
                  { name: "planning", color: "#3b82f6" },
                  { name: "design", color: "#ec4899" },
                  { name: "engineering", color: "#f59e0b" },
                  { name: "meetings", color: "#10b981" },
                  { name: "ideas", color: "#8b5cf6" },
                  { name: "research", color: "#06b6d4" },
                ].map((tag) => (
                  <span
                    key={tag.name}
                    className="inline-flex items-center rounded-full px-4 py-2 text-sm font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
                    style={{
                      background: `color-mix(in srgb, ${tag.color} 14%, #e1e1e1)`,
                      color: "#2f2f2f",
                    }}
                  >
                    <Tag className="mr-1.5 size-3.5 opacity-60" />
                    {tag.name}
                  </span>
                ))}
              </div>

              {/* Copy */}
              <div className="lg:pl-12">
                <p className="mb-3 font-mono text-xs uppercase tracking-[0.15em] text-amber-600">
                  Tags &amp; organization
                </p>
                <h2 className="mb-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Tag it, find it,
                  <br />
                  never lose a thread.
                </h2>
                <p className="max-w-md text-base leading-relaxed text-[#6b6b68]">
                  Assign custom colored tags to any note. Each collaborator
                  keeps their own tag set. Create, rename, recolor, or delete
                  tags with a click. Your system, your way.
                </p>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="px-6 py-32">
        <div className="mx-auto max-w-3xl text-center">
          <RevealOnScroll>
            <h2 className="mb-6 text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
              Start writing
              <br />
              <span className="text-amber-600">today.</span>
            </h2>
            <p className="mx-auto mb-10 max-w-lg text-base leading-relaxed text-[#6b6b68]">
              Free. No credit card. All your notes, always yours.
            </p>
            {isLoggedIn ? (
              <a
                href="/app"
                className="inline-flex items-center justify-center rounded-full bg-[#1a1a18] px-10 py-4 text-lg font-medium text-white transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/20 hover:-translate-y-0.5"
              >
                Open app
                <ArrowRight className="ml-2 inline h-5 w-5" />
              </a>
            ) : (
              <a
                href="/auth/login?screen_hint=signup"
                className="inline-flex items-center justify-center rounded-full bg-[#1a1a18] px-10 py-4 text-lg font-medium text-white transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/20 hover:-translate-y-0.5"
              >
                Begin for free
                <ArrowRight className="ml-2 inline h-5 w-5" />
              </a>
            )}
          </RevealOnScroll>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/5 px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="text-sm text-[#9b9b97]">
            &copy; 2026 Noteey. Crafted for thinkers.
          </span>
          <div className="flex gap-6 text-sm text-[#9b9b97]">
            <span className="cursor-pointer transition-colors duration-300 hover:text-[#1a1a18]">
              Privacy
            </span>
            <span className="cursor-pointer transition-colors duration-300 hover:text-[#1a1a18]">
              Terms
            </span>
            <span className="cursor-pointer transition-colors duration-300 hover:text-[#1a1a18]">
              Twitter
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
