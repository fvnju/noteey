"use client";

import { useEffect, useRef, useReducer, useCallback } from "react";
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
  picture: string | null;
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
  picture: string | null;
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

type CollabState = {
  isConnected: boolean;
  users: UserInfo[];
  remoteCursors: RemoteCursor[];
  bufferedContent: string | null;
  isCommitting: boolean;
};

type CollabAction =
  | { type: "CONNECTED" }
  | { type: "DISCONNECTED" }
  | { type: "ROOM_JOINED"; bufferedContent: string | null; users: UserInfo[] }
  | { type: "USER_JOINED"; user: UserInfo }
  | { type: "USER_LEFT"; userId: string }
  | { type: "CURSOR_UPDATE"; cursor: RemoteCursor }
  | { type: "COMMIT_START" }
  | { type: "COMMIT_END" }
  | { type: "RESET" };

const initialCollabState: CollabState = {
  isConnected: false,
  users: [],
  remoteCursors: [],
  bufferedContent: null,
  isCommitting: false,
};

const COMMIT_ACK_TIMEOUT_MS = 10000;
const ANDROID_EMULATOR_HOST = "10.0.2.2";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

function resolveRealtimeUrl(realtimeUrl: string) {
  if (typeof window === "undefined") return realtimeUrl;
  if (window.location.hostname !== ANDROID_EMULATOR_HOST) return realtimeUrl;

  try {
    const url = new URL(realtimeUrl);
    if (LOOPBACK_HOSTS.has(url.hostname)) {
      url.hostname = ANDROID_EMULATOR_HOST;
    }
    return url.toString();
  } catch {
    return realtimeUrl;
  }
}

function collabReducer(state: CollabState, action: CollabAction): CollabState {
  switch (action.type) {
    case "CONNECTED":
      return { ...state, isConnected: true };
    case "DISCONNECTED":
      return { ...state, isConnected: false };
    case "ROOM_JOINED":
      return {
        ...state,
        isConnected: true,
        bufferedContent: action.bufferedContent ?? state.bufferedContent,
        users: action.users.length > 0 ? action.users : state.users,
      };
    case "USER_JOINED": {
      const found = state.users.some((u) => u.userId === action.user.userId);
      const users = found
        ? state.users.map((u) =>
            u.userId === action.user.userId ? { ...u, online: true } : u,
          )
        : [...state.users, action.user];
      return { ...state, users };
    }
    case "USER_LEFT":
      return {
        ...state,
        users: state.users.map((u) =>
          u.userId === action.userId ? { ...u, online: false } : u,
        ),
        remoteCursors: state.remoteCursors.filter(
          (c) => c.userId !== action.userId,
        ),
      };
    case "CURSOR_UPDATE": {
      const others = state.remoteCursors.filter(
        (c) => c.userId !== action.cursor.userId,
      );
      return { ...state, remoteCursors: [...others, action.cursor] };
    }
    case "COMMIT_START":
      return { ...state, isCommitting: true };
    case "COMMIT_END":
      return { ...state, isCommitting: false };
    case "RESET":
      return initialCollabState;
  }
}

export function useCollabSocket({
  noteId,
  token,
  realtimeUrl,
}: UseCollabSocketOptions): UseCollabSocketReturn {
  const [state, dispatch] = useReducer(collabReducer, initialCollabState);
  const resolvedRealtimeUrl = resolveRealtimeUrl(realtimeUrl);

  const socketRef = useRef<Socket | null>(null);
  const remoteDocHandlersRef = useRef<Set<(content: string) => void>>(new Set());
  const joinAttemptedRef = useRef(false);

  useEffect(() => {
    if (!noteId || !token) {
      // Clean up any socket from a previous effect run where noteId/token were set.
      const prev = socketRef.current;
      if (prev) {
        prev.removeAllListeners();
        prev.disconnect();
        socketRef.current = null;
        dispatch({ type: "RESET" });
      }
      return;
    }

    joinAttemptedRef.current = false;

    const socket = io(resolvedRealtimeUrl, {
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
            dispatch({ type: "CONNECTED" });
          }
        });
      }
    });

    socket.on("room:joined", ({ bufferedContent: bc, users: existingUsers }: { bufferedContent?: string | null; users?: Array<{ userId: string; name: string; picture: string | null }> }) => {
      dispatch({
        type: "ROOM_JOINED",
        bufferedContent: bc ?? null,
        users: (existingUsers ?? []).map((u) => ({ ...u, online: true })),
      });
    });

    socket.on("user:joined", (user: { userId: string; name: string; picture: string | null }) => {
      dispatch({ type: "USER_JOINED", user: { ...user, online: true } });
    });

    socket.on("user:left", ({ userId }: { userId: string }) => {
      dispatch({ type: "USER_LEFT", userId });
    });

    socket.on("doc:remote", ({ content }: { content: string }) => {
      for (const handler of remoteDocHandlersRef.current) {
        handler(content);
      }
    });

    socket.on("cursor:remote", (cursor: CursorPosition) => {
      dispatch({
        type: "CURSOR_UPDATE",
        cursor: { ...cursor, color: userColor(cursor.userId) },
      });
    });

    socket.on("commit:result", () => {
      dispatch({ type: "COMMIT_END" });
    });

    socket.on("disconnect", () => {
      dispatch({ type: "DISCONNECTED" });
    });

    socket.on("connect_error", () => {
      dispatch({ type: "DISCONNECTED" });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      dispatch({ type: "RESET" });
    };
  }, [noteId, token, resolvedRealtimeUrl]);

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
      dispatch({ type: "COMMIT_START" });
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        dispatch({ type: "COMMIT_END" });
        resolve({ ok: false, error: "No response" });
      }, COMMIT_ACK_TIMEOUT_MS);
      socketRef.current.emit("commit:request", { noteId }, (res: { ok: boolean; error?: string; version?: number }) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        if (!res?.ok) dispatch({ type: "COMMIT_END" });
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

  const { isConnected, users, remoteCursors, bufferedContent, isCommitting } = state;

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
