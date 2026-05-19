"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { Button, Card } from "@heroui/react";
import {
  ArrowRight,
  BookOpen,
  Layers,
  MessageCircle,
  Palette,
  Sparkles,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const features = [
  {
    icon: Sparkles,
    title: "Capture Instantly",
    description:
      "Thoughts don't wait. Open, write, done. Your ideas land on the canvas before they slip away.",
  },
  {
    icon: Layers,
    title: "Organize Effortlessly",
    description:
      "Group, tag, and connect notes into living structures that grow with your thinking.",
  },
  {
    icon: Palette,
    title: "Style Your Way",
    description:
      "Typography, colors, and layouts that adapt to your taste — not the other way around.",
  },
  {
    icon: MessageCircle,
    title: "AI-Assisted Clarity",
    description:
      "Summarize, elaborate, or find connections across your notes with a single conversation.",
  },
  {
    icon: BookOpen,
    title: "Readable Forever",
    description:
      "Markdown-native with rich previews. Your notes look as good next year as they do today.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description:
      "Built on modern infrastructure. Pages render before your finger leaves the key.",
  },
];

const steps = [
  {
    step: "01",
    title: "Write freely",
    description: "Open a new note and let your thoughts flow. No friction, no structure required.",
  },
  {
    step: "02",
    title: "Let patterns emerge",
    description: "Tags, backlinks, and AI surface connections you didn't know were there.",
  },
  {
    step: "03",
    title: "Find anything instantly",
    description: "Search across every word you've ever written. Your second brain, always awake.",
  },
];

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
      { threshold: 0.1, rootMargin: "0px 0px -80px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      } ${className ?? ""}`}
    >
      {children}
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
      <nav
        className={`fixed top-0 z-50 w-full transition-all duration-500 ${
          scrolled
            ? "border-b border-black/5 bg-[#fafaf8]/80 backdrop-blur-xl"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">noteey</span>
          <div className="flex items-center gap-6">
            <Button
              variant="ghost"
              size="md"
              className="text-sm font-medium text-[#6b6b68] transition-colors duration-300 hover:text-[#1a1a18]"
              onPress={() =>
                document
                  .getElementById("features")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Features
            </Button>
            {isLoggedIn ? (
              <a
                href="/app"
                className="inline-flex items-center justify-center rounded-full bg-[#1a1a18] px-5 py-2 text-sm font-medium text-white transition-colors duration-300 hover:bg-[#1a1a18]/80"
              >
                Dashboard
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
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-20 text-center">
        <div
          className={`max-w-3xl transition-all duration-1000 ease-out ${
            heroVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
          }`}
        >
          <p className="mb-6 font-mono text-xs uppercase tracking-[0.2em] text-[#9b9b97]">
            A quiet place for your thoughts
          </p>
          <h1 className="mb-8 text-6xl font-bold leading-[1.08] tracking-tight sm:text-7xl md:text-8xl">
            Where ideas
            <br />
            <span className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 bg-clip-text text-transparent">
              find their shape.
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-[#6b6b68]">
            Noteey is a minimal, intelligent note-taking space designed for how
            your mind actually works — fluid, connected, and quietly powerful.
          </p>
          <div className="flex items-center justify-center gap-4">
            {isLoggedIn ? (
              <a
                href="/app"
                className="inline-flex items-center justify-center rounded-full bg-[#1a1a18] px-8 py-3 text-base font-medium text-white transition-colors duration-300 hover:bg-[#1a1a18]/80"
              >
                Go to dashboard
                <ArrowRight className="ml-2 inline h-4 w-4" />
              </a>
            ) : (
              <>
                <a
                  href="/auth/login?screen_hint=signup"
                  className="inline-flex items-center justify-center rounded-full bg-[#1a1a18] px-8 py-3 text-base font-medium text-white transition-colors duration-300 hover:bg-[#1a1a18]/80"
                >
                  Start writing free
                  <ArrowRight className="ml-2 inline h-4 w-4" />
                </a>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center rounded-full border border-black/10 px-8 py-3 text-base font-medium text-[#6b6b68] transition-colors duration-300 hover:text-[#1a1a18]"
                >
                  See how it works
                </a>
              </>
            )}
          </div>
        </div>

        <div
          className={`absolute bottom-12 transition-all delay-700 duration-700 ${
            heroVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="animate-bounce rounded-full border border-black/10 p-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="text-[#9b9b97]"
            >
              <path
                d="M4 6L8 10L12 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-32">
        <div className="mx-auto max-w-6xl">
          <RevealOnScroll className="mb-20 text-center">
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-[#9b9b97]">
              Everything you need
            </p>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Thoughtfully designed
              <br />
              <span className="text-[#9b9b97]">for deep thinking.</span>
            </h2>
          </RevealOnScroll>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <RevealOnScroll key={feature.title} delay={i * 0.08}>
                <Card className="group border border-black/5 bg-white/60 p-8 backdrop-blur-sm transition-all duration-500 hover:border-amber-200/60 hover:bg-white hover:shadow-lg hover:shadow-amber-500/5">
                  <div className="mb-5 inline-flex rounded-xl bg-amber-50 p-3 text-amber-600 transition-colors duration-500 group-hover:bg-amber-100">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-[#6b6b68]">
                    {feature.description}
                  </p>
                </Card>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-y border-black/5 bg-white/40 px-6 py-32">
        <div className="mx-auto max-w-6xl">
          <RevealOnScroll className="mb-20 text-center">
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-[#9b9b97]">
              Three steps to clarity
            </p>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Think. Connect.
              <br />
              <span className="text-[#9b9b97]">Discover.</span>
            </h2>
          </RevealOnScroll>

          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((item, i) => (
              <RevealOnScroll key={item.step} delay={i * 0.12}>
                <div className="relative">
                  <span className="mb-6 block font-mono text-sm font-medium text-amber-500">
                    {item.step}
                  </span>
                  <h3 className="mb-3 text-xl font-semibold tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-[#6b6b68]">
                    {item.description}
                  </p>
                  {i < steps.length - 1 && (
                    <div className="absolute right-0 top-6 hidden h-px w-16 bg-gradient-to-r from-black/5 to-transparent md:block" />
                  )}
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="px-6 py-32">
        <div className="mx-auto max-w-3xl text-center">
          <RevealOnScroll>
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-[#9b9b97]">
              Start today
            </p>
            <h2 className="mb-8 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Your thoughts
              <br />
              <span className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 bg-clip-text text-transparent">
                deserve a home.
              </span>
            </h2>
            <p className="mx-auto mb-10 max-w-lg text-base leading-relaxed text-[#6b6b68]">
              Free to start. No credit card required. All your notes, always
              yours.
            </p>
            {isLoggedIn ? (
              <a
                href="/app"
                className="inline-flex items-center justify-center rounded-full bg-[#1a1a18] px-10 py-6 text-lg font-medium text-white shadow-lg shadow-amber-500/20 transition-shadow duration-500 hover:shadow-xl hover:shadow-amber-500/30"
              >
                Open dashboard
                <ArrowRight className="ml-2 inline h-5 w-5" />
              </a>
            ) : (
              <a
                href="/auth/login?screen_hint=signup"
                className="inline-flex items-center justify-center rounded-full bg-[#1a1a18] px-10 py-6 text-lg font-medium text-white shadow-lg shadow-amber-500/20 transition-shadow duration-500 hover:shadow-xl hover:shadow-amber-500/30"
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
            © 2026 Noteey. Crafted for thinkers.
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
