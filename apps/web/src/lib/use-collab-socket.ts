"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";

function userColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 78%, 56%)`;
}

type UserInfo = {
  userId: string;
  name: string;
  picture: string | null;
  online: boolean;
};

type CursorPosition = {
  userId: string;
  name: string;
  from: number;
  to: number;
};

type UseCollabSocketOptions = {
  noteId: string | null;
  token: string | null;
  realtimeUrl: string;
};

type RemoteCursor = {
  userId: string;
  name: string;
  color: string;
  from: number;
  to: number;
};

export type UseCollabSocketReturn = {
  isConnected: boolean;
  users: UserInfo[];
  remoteCursors: RemoteCursor[];
  bufferedContent: string | null;
  isCommitting: boolean;
  sendDocUpdate: (content: string) => void;
  sendCursor: (from: number, to: number) => void;
  requestCommit: () => Promise<{ ok: boolean; error?: string; version?: number }>;
  onRemoteDocUpdate: (handler: (content: string) => void) => () => void;
};

export function useCollabSocket({
  noteId,
  token,
  realtimeUrl,
}: UseCollabSocketOptions): UseCollabSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [bufferedContent, setBufferedContent] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const remoteDocHandlersRef = useRef<Set<(content: string) => void>>(new Set());
  const joinAttemptedRef = useRef(false);

  useEffect(() => {
    if (!noteId || !token) return;

    joinAttemptedRef.current = false;

    const socket = io(realtimeUrl, {
      path: "/collab",
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      if (!joinAttemptedRef.current) {
        joinAttemptedRef.current = true;
        socket.emit("room:join", { noteId }, (res: { ok: boolean; error?: string }) => {
          if (res?.ok) {
            setIsConnected(true);
          }
        });
      }
    });

    socket.on("room:joined", ({ bufferedContent: bc, users: existingUsers }: { bufferedContent?: string | null; users?: Array<{ userId: string; name: string; picture: string | null }> }) => {
      setIsConnected(true);
      if (bc) setBufferedContent(bc);
      if (existingUsers && existingUsers.length > 0) {
        setUsers(existingUsers.map((u) => ({ ...u, online: true })));
      }
    });

    socket.on("user:joined", (user: { userId: string; name: string; picture: string | null }) => {
      setUsers((prev) => {
        const found = prev.some((u) => u.userId === user.userId);
        if (found) {
          return prev.map((u) => u.userId === user.userId ? { ...u, online: true } : u);
        }
        return [...prev, { ...user, online: true }];
      });
    });

    socket.on("user:left", ({ userId }: { userId: string }) => {
      setUsers((prev) =>
        prev.map((u) => u.userId === userId ? { ...u, online: false } : u),
      );
      setRemoteCursors((prev) => prev.filter((c) => c.userId !== userId));
    });

    socket.on("doc:remote", ({ content }: { content: string }) => {
      for (const handler of remoteDocHandlersRef.current) {
        handler(content);
      }
    });

    socket.on("cursor:remote", (cursor: CursorPosition) => {
      setRemoteCursors((prev) => {
        const others = prev.filter((c) => c.userId !== cursor.userId);
        return [...others, { ...cursor, color: userColor(cursor.userId) }];
      });
    });

    socket.on("commit:result", ({ ok }: { ok: boolean }) => {
      setIsCommitting(false);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("connect_error", () => {
      setIsConnected(false);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setUsers([]);
      setRemoteCursors([]);
      setIsConnected(false);
    };
  }, [noteId, token, realtimeUrl]);

  const sendDocUpdate = useCallback((content: string) => {
    if (!noteId || !socketRef.current?.connected) return;
    socketRef.current.emit("doc:update", { noteId, content });
  }, [noteId]);

  const sendCursor = useCallback((from: number, to: number) => {
    if (!noteId || !socketRef.current?.connected) return;
    socketRef.current.emit("cursor:update", { noteId, from, to });
  }, [noteId]);

  const requestCommit = useCallback((): Promise<{ ok: boolean; error?: string; version?: number }> => {
    return new Promise((resolve) => {
      if (!noteId || !socketRef.current?.connected) {
        resolve({ ok: false, error: "Not connected" });
        return;
      }
      setIsCommitting(true);
      socketRef.current.emit("commit:request", { noteId }, (res: { ok: boolean; error?: string; version?: number }) => {
        if (!res?.ok) setIsCommitting(false);
        resolve(res ?? { ok: false, error: "No response" });
      });
    });
  }, [noteId]);

  const onRemoteDocUpdate = useCallback((handler: (content: string) => void) => {
    remoteDocHandlersRef.current.add(handler);
    return () => {
      remoteDocHandlersRef.current.delete(handler);
    };
  }, []);

  return {
    isConnected,
    users,
    remoteCursors,
    bufferedContent,
    isCommitting,
    sendDocUpdate,
    sendCursor,
    requestCommit,
    onRemoteDocUpdate,
  };
}
