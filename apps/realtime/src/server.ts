// import { config as loadEnv } from "dotenv";

// loadEnv({ path: "../../.env.local" });
// loadEnv();

import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { Hono } from "hono";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@noteey/backend/convex/_generated/api";
import type { Id } from "@noteey/backend/convex/_generated/dataModel";
import Database from "better-sqlite3";

const port = Number(process.env.PORT ?? process.env.REALTIME_PORT ?? 1235);
const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error("Missing CONVEX_URL or NEXT_PUBLIC_CONVEX_URL");
}
const convexDeploymentUrl: string = convexUrl;

const DB_PATH = process.env.REALTIME_DB_PATH ?? "./realtime.db";
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

db.exec(`
  CREATE TABLE IF NOT EXISTS note_buffer (
    note_id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    committed_version INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );
`);

const upsertBuffer = db.prepare(`
  INSERT INTO note_buffer (note_id, content, version, updated_at, committed_version, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(note_id) DO UPDATE SET
    content = excluded.content,
    version = excluded.version,
    updated_at = excluded.updated_at
`);

const clearBuffer = db.prepare(`
  UPDATE note_buffer SET committed_version = version, updated_at = ? WHERE note_id = ?
`);

const getBuffer = db.prepare(`
  SELECT * FROM note_buffer WHERE note_id = ?
`);

type CollaborationContext = {
  token: string;
  userId: string;
  name: string;
  email: string | null;
  picture: string | null;
  role: "owner" | "editor";
};

const app = new Hono();
app.get("/health", (c) => c.json({ ok: true }));

const httpServer = createServer(async (req, res) => {
  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? `localhost:${port}`}`,
  );
  if (url.pathname === "/health") {
    const honoRes = await app.fetch(
      new Request(url, {
        method: req.method,
        headers: req.headers as ConstructorParameters<typeof Headers>[0],
      }),
    );
    res.writeHead(
      honoRes.status,
      Object.fromEntries(honoRes.headers.entries()),
    );
    res.end(await honoRes.text());
    return;
  }
  res.writeHead(404);
  res.end("Not Found");
});

const io = new SocketIOServer(httpServer, {
  path: "/collab",
  cors: { origin: "*", methods: ["GET", "POST"] },
  connectTimeout: 10000,
  pingTimeout: 30000,
  pingInterval: 15000,
});

function convexClient(token: string) {
  const client = new ConvexHttpClient(convexDeploymentUrl);
  client.setAuth(token);
  return client;
}

io.on("connection", async (socket) => {
  const token = socket.handshake.auth?.token as string | undefined;
  let ctx: CollaborationContext | null = null;
  let currentNoteId: Id<"notes"> | null = null;

  socket.on(
    "room:join",
    async ({ noteId }: { noteId: string }, ack?: (res: unknown) => void) => {
      try {
        if (!token) throw new Error("Missing auth token");
        const nid = noteId as Id<"notes">;
        const auth = await convexClient(token).query(
          api.collaboration.authenticateRoom,
          { noteId: nid },
        );
        ctx = {
          token,
          userId: auth.userId,
          name: auth.name,
          email: auth.email,
          picture: auth.picture,
          role: auth.role,
        };
        currentNoteId = nid;

        await socket.join(`note:${noteId}`);

        const buffer = getBuffer.get(noteId) as
          | { content: string; version: number; committed_version: number }
          | undefined;
        const bufferedContent =
          buffer && buffer.version > buffer.committed_version
            ? buffer.content
            : null;

        const existingUsers: Array<{
          userId: string;
          name: string;
          picture: string | null;
        }> = [];
        const sockets = await io.in(`note:${noteId}`).fetchSockets();
        for (const s of sockets) {
          if (s.id === socket.id) continue;
          const data = s.data as
            | { userId?: string; name?: string; picture?: string | null }
            | undefined;
          if (data?.userId && data?.name) {
            existingUsers.push({
              userId: data.userId,
              name: data.name,
              picture: data.picture ?? null,
            });
          }
        }

        socket.data = {
          userId: ctx.userId,
          name: ctx.name,
          picture: ctx.picture,
        };

        socket.emit("room:joined", {
          noteId,
          bufferedContent,
          users: existingUsers,
        });
        socket.to(`note:${noteId}`).emit("user:joined", {
          userId: ctx.userId,
          name: ctx.name,
          picture: ctx.picture,
        });

        ack?.({ ok: true });
      } catch (err) {
        ack?.({
          ok: false,
          error: err instanceof Error ? err.message : "Auth failed",
        });
      }
    },
  );

  socket.on(
    "doc:update",
    ({ noteId, content }: { noteId: string; content: string }) => {
      if (!ctx || !currentNoteId || currentNoteId !== (noteId as Id<"notes">))
        return;

      const now = Date.now();
      const existing = getBuffer.get(noteId) as
        | { version: number; committed_version: number }
        | undefined;
      const newVersion = (existing?.version ?? 0) + 1;

      upsertBuffer.run(
        noteId,
        content,
        newVersion,
        now,
        existing?.committed_version ?? 0,
        now,
      );

      socket.to(`note:${noteId}`).emit("doc:remote", {
        content,
        userId: ctx.userId,
        version: newVersion,
      });
    },
  );

  socket.on(
    "commit:request",
    async ({ noteId }: { noteId: string }, ack?: (res: unknown) => void) => {
      try {
        if (
          !ctx ||
          !currentNoteId ||
          currentNoteId !== (noteId as Id<"notes">)
        ) {
          ack?.({ ok: false, error: "Not in room" });
          return;
        }
        if (ctx.role !== "owner") {
          ack?.({ ok: false, error: "Only the owner can commit" });
          return;
        }

        const buffer = getBuffer.get(noteId) as
          | { content: string; version: number; committed_version: number }
          | undefined;
        if (!buffer || buffer.version === 0) {
          ack?.({ ok: false, error: "Nothing to commit" });
          return;
        }

        await convexClient(ctx.token).mutation(
          api.collaboration.commitCollabSnapshot,
          {
            noteId: currentNoteId,
            version: buffer.version,
            content: buffer.content,
          },
        );

        clearBuffer.run(Date.now(), noteId);

        io.to(`note:${noteId}`).emit("commit:result", {
          ok: true,
          version: buffer.version,
        });
        ack?.({ ok: true, version: buffer.version });
      } catch (err) {
        ack?.({
          ok: false,
          error: err instanceof Error ? err.message : "Commit failed",
        });
      }
    },
  );

  socket.on(
    "cursor:update",
    ({ noteId, from, to }: { noteId: string; from: number; to: number }) => {
      if (!ctx || !currentNoteId) return;
      socket.to(`note:${noteId}`).emit("cursor:remote", {
        userId: ctx.userId,
        name: ctx.name,
        picture: ctx.picture,
        from,
        to,
      });
    },
  );

  socket.on("disconnect", () => {
    if (ctx && currentNoteId) {
      socket
        .to(`note:${currentNoteId}`)
        .emit("user:left", { userId: ctx.userId });
    }
  });
});

const shutdown = async (signal: NodeJS.Signals) => {
  console.log(`Received ${signal}, shutting down...`);
  await new Promise<void>((resolve) => {
    io.close(() => resolve());
  });
  httpServer.close(() => {
    db.close();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

httpServer.listen(port, () => {
  console.log(
    `noteey realtime server listening on :${port} (socket.io + sqlite buffer)`,
  );
});
