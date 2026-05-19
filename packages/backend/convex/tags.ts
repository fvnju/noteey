import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

async function requireNoteAccess(
  ctx: QueryCtx | MutationCtx,
  noteId: Id<"notes">,
  userId: string,
) {
  const note = await ctx.db.get(noteId);
  if (!note) throw new Error("Note not found");
  if (note.userId === userId) return;

  const collaborator = await ctx.db
    .query("noteCollaborators")
    .withIndex("by_noteId_and_userId", (q) =>
      q.eq("noteId", noteId).eq("userId", userId),
    )
    .unique();
  if (!collaborator) throw new Error("Not authorized");
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return ctx.db
      .query("tags")
      .withIndex("by_userId", (q) =>
        q.eq("userId", identity.tokenIdentifier),
      )
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return ctx.db.insert("tags", {
      userId: identity.tokenIdentifier,
      name: args.name.trim(),
      color: args.color,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("tags"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const tag = await ctx.db.get(args.id);
    if (!tag) throw new Error("Tag not found");
    if (tag.userId !== identity.tokenIdentifier) throw new Error("Not authorized");

    const patch: { name?: string; color?: string } = {};
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.color !== undefined) patch.color = args.color;

    return ctx.db.patch(args.id, patch);
  },
});

export const remove = mutation({
  args: {
    id: v.id("tags"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const tag = await ctx.db.get(args.id);
    if (!tag) throw new Error("Tag not found");
    if (tag.userId !== identity.tokenIdentifier) throw new Error("Not authorized");

    const assignments = await ctx.db
      .query("noteUserTags")
      .withIndex("by_userId_and_tagId", (q) =>
        q.eq("userId", identity.tokenIdentifier).eq("tagId", args.id),
      )
      .collect();
    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id);
    }

    return ctx.db.delete(args.id);
  },
});

export const assignToNote = mutation({
  args: {
    noteId: v.id("notes"),
    tagId: v.id("tags"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const tag = await ctx.db.get(args.tagId);
    if (!tag) throw new Error("Tag not found");
    if (tag.userId !== identity.tokenIdentifier) throw new Error("Not authorized");

    await requireNoteAccess(ctx, args.noteId, identity.tokenIdentifier);

    const existing = await ctx.db
      .query("noteUserTags")
      .withIndex("by_userId_and_noteId", (q) =>
        q
          .eq("userId", identity.tokenIdentifier)
          .eq("noteId", args.noteId),
      )
      .filter((q) => q.eq(q.field("tagId"), args.tagId))
      .unique();
    if (existing) return existing._id;

    return ctx.db.insert("noteUserTags", {
      userId: identity.tokenIdentifier,
      noteId: args.noteId,
      tagId: args.tagId,
    });
  },
});

export const unassignFromNote = mutation({
  args: {
    noteId: v.id("notes"),
    tagId: v.id("tags"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("noteUserTags")
      .withIndex("by_userId_and_noteId", (q) =>
        q
          .eq("userId", identity.tokenIdentifier)
          .eq("noteId", args.noteId),
      )
      .filter((q) => q.eq(q.field("tagId"), args.tagId))
      .unique();
    if (!existing) return null;

    await ctx.db.delete(existing._id);
    return existing._id;
  },
});
