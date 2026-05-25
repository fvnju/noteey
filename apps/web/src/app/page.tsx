import type { Metadata } from "next";
import LandingPage from "@/components/landing-page";

export const metadata: Metadata = {
  title: "Noteey — Where ideas find their shape",
  description:
    "A minimal, intelligent note-taking space designed for how your mind actually works — fluid, connected, and quietly powerful.",
};

export default function Page() {
  return <LandingPage />;
}
