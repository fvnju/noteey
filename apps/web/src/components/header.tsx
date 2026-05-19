"use client";
import { useUser } from "@auth0/nextjs-auth0/client";
import Link from "next/link";

import { ModeToggle } from "./mode-toggle";

export default function Header() {
  const { user, isLoading } = useUser();
  const links = [{ to: "/", label: "Home" }] as const;

  return (
    <div>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        <nav className="flex gap-4 text-lg">
          {links.map(({ to, label }) => {
            return (
              <Link key={to} href={to}>
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <span className="text-sm text-muted-foreground">Loading...</span>
          ) : user ? (
            <div className="flex items-center gap-3">
              {user.picture && (
                <img
                  src={user.picture}
                  alt={user.name ?? ""}
                  className="h-7 w-7 rounded-full"
                />
              )}
              <span className="text-sm">{user.name}</span>
              <a
                href="/auth/logout"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Logout
              </a>
            </div>
          ) : (
            <a
              href="/auth/login"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Login
            </a>
          )}
          <ModeToggle />
        </div>
      </div>
      <hr />
    </div>
  );
}
