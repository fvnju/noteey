// import { config as loadEnv } from "dotenv";

// loadEnv({ path: "../../.env.local" });
// loadEnv();

import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@noteey/backend/convex/_generated/api";
import type { Id } from "@noteey/backend/convex/_generated/dataModel";
import Database from "better-sqlite3";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type JSONSchema7, type UIMessage } from "ai";
import {
  injectDocumentStateMessages,
  toolDefinitionsToToolSet,
} from "@blocknote/xl-ai/server";

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
app.use("/ai", cors());
const aiRequestsByUser = new Map<
  string,
  { timestamps: number[] }
>();
const AI_RATE_LIMIT_MAX =
  Number(process.env.AI_RATE_LIMIT_MAX_REQUESTS ?? 20) || 20;
const AI_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const AI_MODEL = process.env.AI_MODEL ?? "gpt-4o-mini";
const AI_BASE_URL = process.env.AI_BASE_URL;
const AI_API_KEY = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;

type ToolDefinitions = Record<
  string,
  {
    description?: string;
    inputSchema: JSONSchema7;
    outputSchema: JSONSchema7;
  }
>;

const aiProvider = createOpenAI({
  ...(AI_BASE_URL ? { baseURL: AI_BASE_URL } : {}),
  ...(AI_API_KEY ? { apiKey: AI_API_KEY } : {}),
});

function pruneRateLimitBucket(bucket: { timestamps: number[] }) {
  const now = Date.now();
  bucket.timestamps = bucket.timestamps.filter(
    (timestamp) => now - timestamp < AI_RATE_LIMIT_WINDOW_MS,
  );
}

function checkAiRateLimit(userId: string) {
  let bucket = aiRequestsByUser.get(userId);
  if (!bucket) {
    bucket = { timestamps: [] };
    aiRequestsByUser.set(userId, bucket);
  }
  pruneRateLimitBucket(bucket);
  if (bucket.timestamps.length >= AI_RATE_LIMIT_MAX) {
    return false;
  }
  bucket.timestamps.push(Date.now());
  return true;
}

function parseBearerToken(req: Request) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  return authorization.slice("Bearer ".length).trim() || null;
}

function extractLastUserText(messages: UIMessage[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "user") continue;

    const text = message.parts
      ?.map((part) =>
        part && "text" in part && typeof part.text === "string"
          ? part.text
          : "",
      )
      .filter(Boolean)
      .join("\n");

    if (text) return text;
  }

  return "";
}

function formatLogError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return error;
}

function logAi(message: string, meta?: Record<string, unknown>) {
  console.info(`[ai] ${message}`, meta ?? "");
}

function logAiError(message: string, error: unknown, meta?: Record<string, unknown>) {
  console.error(`[ai] ${message}`, {
    ...meta,
    error: formatLogError(error),
  });
}

app.get("/health", (c) => c.json({ ok: true }));

app.post("/ai", async (c) => {
  const requestId = crypto.randomUUID();
  logAi("request received", {
    requestId,
    method: c.req.method,
    path: c.req.path,
    hasAuthorization: Boolean(c.req.header("authorization")),
  });

  try {
    const token = parseBearerToken(c.req.raw);
    if (!token) {
      logAi("request rejected: missing authorization token", { requestId });
      return c.text("Missing authorization token", 401);
    }

    const body = await c.req.json<{
      noteId?: string;
      messages?: UIMessage[];
      body?: {
        toolDefinitions?: ToolDefinitions;
      };
    }>();

    const noteId = body.noteId;
    const messages = body.messages ?? [];
    const prompt = extractLastUserText(messages).trim();
    const toolDefinitions = body.body?.toolDefinitions;

    logAi("request body parsed", {
      requestId,
      noteId,
      messageCount: messages.length,
      promptLength: prompt.length,
      toolCount: toolDefinitions ? Object.keys(toolDefinitions).length : 0,
    });

    if (!noteId) {
      logAi("request rejected: missing noteId", { requestId });
      return c.text("Missing noteId", 400);
    }
    if (messages.length === 0) {
      logAi("request rejected: missing messages", { requestId, noteId });
      return c.text("Missing messages", 400);
    }
    if (!prompt) {
      logAi("request rejected: missing prompt", { requestId, noteId });
      return c.text("Missing prompt", 400);
    }
    if (!toolDefinitions) {
      logAi("request rejected: missing tool definitions", { requestId, noteId });
      return c.text("Missing tool definitions", 400);
    }

    logAi("authenticating request", { requestId, noteId });
    const auth = await convexClient(token).query(
      api.collaboration.authenticateRoom,
      { noteId: noteId as Id<"notes"> },
    );

    logAi("authentication complete", {
      requestId,
      noteId,
      userId: auth.userId,
      role: auth.role,
    });

    if (auth.role !== "owner" && auth.role !== "editor") {
      logAi("request rejected: unauthorized role", {
        requestId,
        noteId,
        userId: auth.userId,
        role: auth.role,
      });
      return c.text("Not authorized to use AI for this note", 403);
    }

    if (!checkAiRateLimit(auth.userId)) {
      logAi("request rejected: rate limited", {
        requestId,
        noteId,
        userId: auth.userId,
      });
      return c.text("AI request limit reached", 429);
    }

    logAi("calling LLM", {
      requestId,
      noteId,
      userId: auth.userId,
      model: AI_MODEL,
      hasBaseUrl: Boolean(AI_BASE_URL),
      hasApiKey: Boolean(AI_API_KEY),
    });

    const tools = toolDefinitionsToToolSet(toolDefinitions);
    const result = streamText({
      model: aiProvider(AI_MODEL),
      system:
        "You are an inline writing assistant inside a collaborative notes app. " +
        "Use the provided tools to apply edits to the note. " +
        "Preserve the user's language unless they explicitly ask for translation. " +
        "Do not add commentary about being an AI.",
      messages: await convertToModelMessages(
        injectDocumentStateMessages(messages),
      ),
      tools,
      toolChoice: "required",
      onError: ({ error }) => {
        logAiError("LLM stream error", error, {
          requestId,
          noteId,
          userId: auth.userId,
          model: AI_MODEL,
        });
      },
      onFinish: ({ usage }) => {
        logAi("LLM stream finished", {
          requestId,
          noteId,
          userId: auth.userId,
          model: AI_MODEL,
          usage,
        });
      },
    });

    logAi("stream response created", { requestId, noteId });
    return result.toUIMessageStreamResponse({
      onError: (error) => {
        logAiError("UI message stream error", error, {
          requestId,
          noteId,
          userId: auth.userId,
          model: AI_MODEL,
        });
        return error instanceof Error ? error.message : "AI request failed";
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI request failed";
    const status =
      error instanceof Error && /not found|authorized/i.test(message)
        ? 403
        : 500;
    logAiError("request failed", error, { requestId, status });
    return c.text(message, status);
  }
});

const httpServer = createServer(async (req, res) => {
  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? `localhost:${port}`}`,
  );

  if (!url.pathname.startsWith("/collab")) {
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const requestInit: RequestInit & { duplex?: "half" } = {
      method: req.method,
      headers: req.headers as ConstructorParameters<typeof Headers>[0],
      body: hasBody ? req : undefined,
      ...(hasBody ? { duplex: "half" as const } : {}),
    };

    const honoRes = await app.fetch(new Request(url, requestInit));
    res.writeHead(
      honoRes.status,
      Object.fromEntries(honoRes.headers.entries()),
    );
    if (!honoRes.body) {
      res.end();
      return;
    }

    const reader = honoRes.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } finally {
      reader.releaseLock();
      res.end();
    }
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
