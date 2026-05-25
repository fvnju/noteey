import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

async function userTagIdsForNote(
  ctx: QueryCtx,
  userId: string,
  noteId: Id<"notes">,
): Promise<Id<"tags">[]> {
  const rows = await ctx.db
    .query("noteUserTags")
    .withIndex("by_userId_and_noteId", (q) =>
      q.eq("userId", userId).eq("noteId", noteId),
    )
    .collect();
  return rows.map((row) => row.tagId);
}

async function attachUserTagIds(
  ctx: QueryCtx,
  userId: string,
  notes: Doc<"notes">[],
): Promise<(Doc<"notes"> & { tagIds: Id<"tags">[] })[]> {
  return Promise.all(
    notes.map(async (note) => ({
      ...note,
      tagIds: await userTagIdsForNote(ctx, userId, note._id),
    })),
  );
}

async function attachUserTagIdsWithOwner(
  ctx: QueryCtx,
  userId: string,
  notes: (Doc<"notes"> & { ownerName?: string })[],
): Promise<(Doc<"notes"> & { tagIds: Id<"tags">[]; ownerName?: string })[]> {
  return Promise.all(
    notes.map(async (note) => ({
      ...note,
      tagIds: await userTagIdsForNote(ctx, userId, note._id),
    })),
  );
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_userId", (q) =>
        q.eq("userId", identity.tokenIdentifier),
      )
      .order("desc")
      .take(100);

    return attachUserTagIds(ctx, identity.tokenIdentifier, notes);
  },
});

export const listSharedWithMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const collaborations = await ctx.db
      .query("noteCollaborators")
      .withIndex("by_userId", (q) =>
        q.eq("userId", identity.tokenIdentifier),
      )
      .take(100);

    const notesWithOwner: (Doc<"notes"> & { ownerName?: string })[] = [];
    for (const collab of collaborations) {
      const note = await ctx.db.get(collab.noteId);
      if (note && note.userId !== identity.tokenIdentifier) {
        const ownerCollab = await ctx.db
          .query("noteCollaborators")
          .withIndex("by_noteId_and_userId", (q) =>
            q.eq("noteId", note._id).eq("userId", note.userId),
          )
          .unique();
        notesWithOwner.push({
          ...note,
          ownerName: ownerCollab?.name ?? ownerCollab?.email ?? "Collaborator",
        });
      }
    }

    notesWithOwner.sort((a, b) => b._creationTime - a._creationTime);

    return attachUserTagIdsWithOwner(ctx, identity.tokenIdentifier, notesWithOwner);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    tagIds: v.optional(v.array(v.id("tags"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const noteId = await ctx.db.insert("notes", {
      userId: identity.tokenIdentifier,
      title: args.title,
      content: args.content,
    });

    await ctx.db.insert("noteCollaborators", {
      noteId,
      userId: identity.tokenIdentifier,
      role: "owner",
      name: identity.name ?? identity.email ?? undefined,
      email: identity.email ?? undefined,
      picture: identity.pictureUrl ?? undefined,
    });

    if (args.tagIds && args.tagIds.length > 0) {
      const seen = new Set<string>();
      for (const tagId of args.tagIds) {
        if (seen.has(tagId)) continue;
        seen.add(tagId);
        const tag = await ctx.db.get(tagId);
        if (!tag) continue;
        if (tag.userId !== identity.tokenIdentifier) continue;
        await ctx.db.insert("noteUserTags", {
          userId: identity.tokenIdentifier,
          noteId,
          tagId,
        });
      }
    }

    return noteId;
  },
});

export const update = mutation({
  args: {
    id: v.id("notes"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const note = await ctx.db.get(args.id);
    if (!note) throw new Error("Note not found");

    const isOwner = note.userId === identity.tokenIdentifier;
    if (!isOwner) {
      const isEditor = await ctx.db
        .query("noteCollaborators")
        .withIndex("by_noteId_and_userId", (q) =>
          q.eq("noteId", args.id).eq("userId", identity.tokenIdentifier),
        )
        .unique();
      if (!isEditor) throw new Error("Not authorized");
    }

    const patch: { title?: string; content?: string } = {};
    if (args.title !== undefined && isOwner) patch.title = args.title;
    if (args.content !== undefined) patch.content = args.content;

    return ctx.db.patch(args.id, patch);
  },
});

export const remove = mutation({
  args: {
    id: v.id("notes"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const note = await ctx.db.get(args.id);
    if (!note) throw new Error("Note not found");
    if (note.userId !== identity.tokenIdentifier) throw new Error("Not authorized");

    const collaborators = await ctx.db
      .query("noteCollaborators")
      .withIndex("by_noteId", (q) => q.eq("noteId", args.id))
      .take(100);
    for (const collaborator of collaborators) {
      await ctx.db.delete(collaborator._id);
    }

    const userTagAssignments = await ctx.db
      .query("noteUserTags")
      .withIndex("by_noteId", (q) => q.eq("noteId", args.id))
      .collect();
    for (const assignment of userTagAssignments) {
      await ctx.db.delete(assignment._id);
    }

    return ctx.db.delete(args.id);
  },
});
