"use client";

import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import { env } from "@noteey/env/web";
import { ToastProvider } from "@heroui/react";
import { Toaster } from "@noteey/ui/components/sonner";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";

import { useAuth0ForConvex } from "@/lib/use-auth0-for-convex";

import { OverlayProvider } from "@/lib/overlay-state";

import { ThemeProvider } from "./theme-provider";

const convex = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL);

export default function Providers({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: { sub: string; name?: string; email?: string; picture?: string };
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <Auth0Provider user={user}>
        <ConvexProviderWithAuth client={convex} useAuth={useAuth0ForConvex}>
          <OverlayProvider>
            {children}
          </OverlayProvider>
        </ConvexProviderWithAuth>
      </Auth0Provider>
      <ToastProvider placement="top" maxVisibleToasts={3} />
      <Toaster richColors />
    </ThemeProvider>
  );
}
