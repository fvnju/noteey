"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useCallback, useMemo } from "react";

export function useAuth0ForConvex() {
  const { user, isLoading } = useUser();

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      try {
        const res = await fetch("/api/convex-token", {
          cache: forceRefreshToken ? "no-store" : "default",
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { token: string | null };
        return data.token;
      } catch (err) {
        console.error("[ConvexAuth] Failed to fetch ID token", err);
        return null;
      }
    },
    [],
  );

  return useMemo(
    () => ({
      isLoading,
      isAuthenticated: !!user,
      fetchAccessToken,
    }),
    [isLoading, user, fetchAccessToken],
  );
}
