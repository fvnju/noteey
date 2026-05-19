import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity;
}

async function getNoteRole(
  ctx: QueryCtx | MutationCtx,
  noteId: Id<"notes">,
  userId: string,
) {
  const note = await ctx.db.get(noteId);
  if (!note) throw new Error("Note not found");

  if (note.userId === userId) return { note, role: "owner" as const };

  const collaborator = await ctx.db
    .query("noteCollaborators")
    .withIndex("by_noteId_and_userId", (q) =>
      q.eq("noteId", noteId).eq("userId", userId),
    )
    .unique();

  if (!collaborator) throw new Error("Not authorized");
  return { note, role: collaborator.role };
}

export const authenticateRoom = query({
  args: {
    noteId: v.id("notes"),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const { note, role } = await getNoteRole(
      ctx,
      args.noteId,
      identity.tokenIdentifier,
    );

    return {
      userId: identity.tokenIdentifier,
      name: identity.name ?? identity.email ?? "Collaborator",
      email: identity.email ?? null,
      picture: identity.pictureUrl ?? null,
      role,
      note: {
        id: note._id,
        title: note.title,
        content: note.content,
      },
    };
  },
});

export const getDocumentState = query({
  args: {
    noteId: v.id("notes"),
  },
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");

    return {
      content: note.content,
      version: note.latestVersion ?? 0,
    };
  },
});

export const commitCollabSnapshot = mutation({
  args: {
    noteId: v.id("notes"),
    version: v.number(),
    content: v.string(),
    snapshot: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    await getNoteRole(ctx, args.noteId, identity.tokenIdentifier);

    const commitId = await ctx.db.insert("noteCollabCommits", {
      noteId: args.noteId,
      version: args.version,
      content: args.content,
      snapshot: args.snapshot,
      committedBy: identity.tokenIdentifier,
      createdAt: Date.now(),
    });

    await ctx.db.patch(args.noteId, {
      content: args.content,
      latestVersion: args.version,
    });

    return { commitId };
  },
});

export const addEditor = mutation({
  args: {
    noteId: v.id("notes"),
    editorUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const { role } = await getNoteRole(ctx, args.noteId, identity.tokenIdentifier);
    if (role !== "owner") throw new Error("Only the owner can share a note");
    if (args.editorUserId === identity.tokenIdentifier) return null;

    const existing = await ctx.db
      .query("noteCollaborators")
      .withIndex("by_noteId_and_userId", (q) =>
        q.eq("noteId", args.noteId).eq("userId", args.editorUserId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { role: "editor" });
      return existing._id;
    }

    return ctx.db.insert("noteCollaborators", {
      noteId: args.noteId,
      userId: args.editorUserId,
      role: "editor",
    });
  },
});

export const createShareCode = mutation({
  args: {
    noteId: v.id("notes"),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    if (note.userId !== identity.tokenIdentifier) {
      throw new Error("Only the owner can create share codes");
    }

    const existing = await ctx.db
      .query("noteShareCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();
    if (existing) throw new Error("Share code already exists");

    await ctx.db.insert("noteShareCodes", {
      noteId: args.noteId,
      code: args.code,
      createdByUserId: identity.tokenIdentifier,
      createdAt: Date.now(),
    });

    return { code: args.code };
  },
});

export const redeemShareCode = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);

    const shareCode = await ctx.db
      .query("noteShareCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();
    if (!shareCode) throw new Error("Invalid share code");

    const note = await ctx.db.get(shareCode.noteId);
    if (!note) throw new Error("Note not found");

    if (note.userId === identity.tokenIdentifier) {
      return { noteId: shareCode.noteId, alreadyAccess: true };
    }

    const existing = await ctx.db
      .query("noteCollaborators")
      .withIndex("by_noteId_and_userId", (q) =>
        q.eq("noteId", shareCode.noteId).eq("userId", identity.tokenIdentifier),
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("noteCollaborators", {
        noteId: shareCode.noteId,
        userId: identity.tokenIdentifier,
        role: "editor",
      });
    }

    return { noteId: shareCode.noteId, alreadyAccess: !!existing };
  },
});
