import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tags: defineTable({
    userId: v.string(),
    name: v.string(),
    color: v.string(),
  }).index("by_userId", ["userId"]),
  notes: defineTable({
    userId: v.string(),
    title: v.string(),
    content: v.string(),
    tagIds: v.optional(v.array(v.id("tags"))),
    latestVersion: v.optional(v.number()),
  }).index("by_userId", ["userId"]),
  // Per-(user, note) tag assignment. Each user maintains their own tag set on a
  // note independently of other collaborators.
  noteUserTags: defineTable({
    userId: v.string(),
    noteId: v.id("notes"),
    tagId: v.id("tags"),
  })
    .index("by_userId_and_noteId", ["userId", "noteId"])
    .index("by_userId_and_tagId", ["userId", "tagId"])
    .index("by_noteId", ["noteId"])
    .index("by_tagId", ["tagId"]),
  noteCollaborators: defineTable({
    noteId: v.id("notes"),
    userId: v.string(),
    role: v.union(v.literal("owner"), v.literal("editor")),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    picture: v.optional(v.string()),
  })
    .index("by_noteId_and_userId", ["noteId", "userId"])
    .index("by_noteId", ["noteId"])
    .index("by_userId", ["userId"]),
  noteCollabCommits: defineTable({
    noteId: v.id("notes"),
    version: v.number(),
    content: v.string(),
    snapshot: v.optional(v.string()),
    committedBy: v.string(),
    createdAt: v.number(),
  })
    .index("by_noteId_and_version", ["noteId", "version"])
    .index("by_noteId", ["noteId"]),
  noteShareCodes: defineTable({
    noteId: v.id("notes"),
    code: v.string(),
    createdByUserId: v.string(),
    createdAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_noteId", ["noteId"]),
});
