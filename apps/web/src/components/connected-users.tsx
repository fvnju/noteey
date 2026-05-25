"use client";

import { Avatar } from "@heroui/react";

type User = {
  userId: string;
  name: string;
  picture: string | null;
  online: boolean;
};

function userHash(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

const FALLBACK_AVATARS = [
  "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/purple.jpg",
  "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
];

function avatarSrc(userId: string, picture: string | null): string | undefined {
  if (picture) return picture;
  return FALLBACK_AVATARS[userHash(userId) % FALLBACK_AVATARS.length];
}

type ConnectedUsersProps = {
  users: User[];
  className?: string;
};

export function ConnectedUsers({ users, className }: ConnectedUsersProps) {
  if (users.length === 0) return null;

  const max = 4;

  return (
    <div className={className || "fixed bottom-4 right-4 z-50 flex -space-x-2"}>
      {users.slice(0, max).map((u) => (
        <div key={u.userId} className="relative">
          <Avatar size="sm" className={u.online ? "" : "opacity-40 grayscale"}>
            <Avatar.Image src={avatarSrc(u.userId, u.picture)} alt={u.name} />
            <Avatar.Fallback>
              {u.name.charAt(0).toUpperCase()}
            </Avatar.Fallback>
          </Avatar>
          <span
            className={`absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background ${
              u.online ? "bg-green-500" : "bg-muted-foreground/40"
            }`}
          />
        </div>
      ))}
      {users.length > max && (
        <Avatar size="sm">
          <Avatar.Fallback>
            <span className="text-xs">+{users.length - max}</span>
          </Avatar.Fallback>
        </Avatar>
      )}
    </div>
  );
}
