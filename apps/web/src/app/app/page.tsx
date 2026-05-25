"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Search } from "lucide-react";
import dynamic from "next/dynamic";
import type { PartialBlock } from "@blocknote/core";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { env } from "@noteey/env/web";
import { api } from "@noteey/backend/convex/_generated/api";
import type { Id } from "@noteey/backend/convex/_generated/dataModel";

import { CommandPalette, CMDK_SPRING } from "@/components/command-palette";
import { NoteSkeleton } from "@/components/editor/note-skeleton";
import { ProfilePill } from "@/components/profile-pill";
import { ConnectedUsers } from "@/components/connected-users";
import { useCollabSocket } from "@/lib/use-collab-socket";
import { toast } from "sonner";

const RichTextEditor = dynamic(
  () =>
    import("@/components/editor/rich-text-editor").then(
      (mod) => mod.RichTextEditor,
    ),
  { ssr: false },
);

const DEFAULT_CONTENT = JSON.stringify([{ type: "paragraph" }]);
const DEFAULT_TAG_COLOR = "hsl(222, 84%, 56%)";

function setUrlNoteId(noteId: string | null) {
  const url = new URL(window.location.href);
  if (noteId) {
    url.searchParams.set("noteId", noteId);
  } else {
    url.searchParams.delete("noteId");
  }
  window.history.replaceState({}, "", url.toString());
}

export default function AppPage() {
  const { user } = useUser();
  const notes = useQuery(api.notes.list);
  const sharedNotes = useQuery(api.notes.listSharedWithMe);
  const tags = useQuery(api.tags.list);
  const createNote = useMutation(api.notes.create);
  const updateNote = useMutation(api.notes.update);
  const deleteNote = useMutation(api.notes.remove);
  const addEditor = useMutation(api.collaboration.addEditor);
  const createShareCode = useMutation(api.collaboration.createShareCode);
  const redeemShareCode = useMutation(api.collaboration.redeemShareCode);
  const createTag = useMutation(api.tags.create);
  const updateTag = useMutation(api.tags.update);
  const deleteTag = useMutation(api.tags.remove);
  const assignTag = useMutation(api.tags.assignToNote);
  const unassignTag = useMutation(api.tags.unassignFromNote);

  const [noteId, setNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<PartialBlock[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Id<"tags">[]>([]);
  const [contentVersion, setContentVersion] = useState(0);
  const [collaborationToken, setCollaborationToken] = useState<
    string | null | "loading"
  >("loading");
  const [hasUncommittedChanges, setHasUncommittedChanges] = useState(false);
  const [, setIsNewNote] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);

  const noteCollaborators = useQuery(
    api.collaboration.listCollaborators,
    noteId ? { noteId: noteId as Id<"notes"> } : "skip",
  );

  const collab = useCollabSocket({
    noteId,
    token: collaborationToken === "loading" ? null : collaborationToken,
    realtimeUrl: env.NEXT_PUBLIC_REALTIME_URL ?? "ws://localhost:1235",
  });

  // Merge persisted collaborators with live online status from the collab socket.
  const allContributors = useMemo(() => {
    if (!noteCollaborators) return collab.users;

    const onlineMap = new Map(collab.users.map((u) => [u.userId, u.online]));
    const seen = new Set<string>();

    const merged = noteCollaborators.map((c) => {
      seen.add(c.userId);
      return {
        userId: c.userId,
        name: c.name ?? "Collaborator",
        picture: c.picture,
        online: onlineMap.get(c.userId) ?? false,
      };
    });

    // Include any live users not yet in the persisted list
    for (const u of collab.users) {
      if (!seen.has(u.userId)) {
        merged.push(u);
      }
    }

    return merged;
  }, [noteCollaborators, collab.users]);

  const initialized = useRef(false);
  const intendedNoteId = useRef<string | null>(null);
  if (typeof window !== "undefined" && intendedNoteId.current === null) {
    const params = new URLSearchParams(window.location.search);
    intendedNoteId.current = params.get("noteId");
  }
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingSave = useRef<{
    title?: string;
    content?: string;
  }>({});
  const lastAcknowledged = useRef<{
    title: string;
    content: string;
    tagIds: Id<"tags">[];
  } | null>(null);

  const isOwner = useMemo(() => {
    if (!noteId || !notes) return false;
    return notes.some((n) => n._id === noteId);
  }, [noteId, notes]);

  const handleSelectNote = useCallback(
    (id: string) => {
      if (id === noteId) return;
      const note = notes?.find((n) => n._id === id) ?? sharedNotes?.find((n) => n._id === id);
      if (!note) return;
      setNoteId(id);
      setTitle(note.title);
      setSelectedTagIds(note.tagIds ?? []);
      try {
        setBlocks(JSON.parse(note.content));
      } catch {
        setBlocks([{ type: "paragraph" }]);
      }
      lastAcknowledged.current = {
        title: note.title,
        content: note.content,
        tagIds: note.tagIds ?? [],
      };
      setHasUncommittedChanges(false);
      setContentVersion((v) => v + 1);
      setUrlNoteId(id);
    },
    [notes, sharedNotes, noteId],
  );

  const handleCreateNote = useCallback(async () => {
    const id = await createNote({
      title: "Untitled",
      content: DEFAULT_CONTENT,
    });
    setNoteId(id);
    setTitle("Untitled");
    setBlocks([{ type: "paragraph" }]);
    setSelectedTagIds([]);
    lastAcknowledged.current = {
      title: "Untitled",
      content: DEFAULT_CONTENT,
      tagIds: [],
    };
    setHasUncommittedChanges(false);
    setContentVersion((v) => v + 1);
    setIsNewNote(true);
    setUrlNoteId(id);
  }, [createNote]);

  const handleDeleteNote = useCallback(
    async (id: string) => {
      await deleteNote({ id: id as never });
      if (noteId === id) {
        setNoteId(null);
        setTitle("");
        setBlocks([]);
        setSelectedTagIds([]);
        setHasUncommittedChanges(false);
        lastAcknowledged.current = null;
        setUrlNoteId(null);
      }
    },
    [deleteNote, noteId],
  );

  useEffect(() => {
    if (notes === undefined) return;

    if (!initialized.current) {
      initialized.current = true;

      if (intendedNoteId.current) {
        const target =
          notes.find((n) => n._id === intendedNoteId.current) ??
          sharedNotes?.find((n) => n._id === intendedNoteId.current);
        if (target) {
          setNoteId(target._id);
          setTitle(target.title);
          setSelectedTagIds(target.tagIds ?? []);
          try {
            setBlocks(JSON.parse(target.content));
          } catch {
            setBlocks([{ type: "paragraph" }]);
          }
          lastAcknowledged.current = {
            title: target.title,
            content: target.content,
            tagIds: target.tagIds ?? [],
          };
          setHasUncommittedChanges(false);
          setContentVersion((v) => v + 1);
          return;
        }
        setUrlNoteId(null);
      }

      if (notes.length === 0) {
        createNote({ title: "Untitled", content: DEFAULT_CONTENT });
        return;
      }
    }

    if (notes.length > 0 && noteId === null) {
      const note = notes[0];
      setNoteId(note._id);
      setTitle(note.title);
      setSelectedTagIds(note.tagIds ?? []);
      try {
        setBlocks(JSON.parse(note.content));
      } catch {
        setBlocks([{ type: "paragraph" }]);
      }
      lastAcknowledged.current = {
        title: note.title,
        content: note.content,
        tagIds: note.tagIds ?? [],
      };
      setHasUncommittedChanges(false);
      setContentVersion((v) => v + 1);
      return;
    }

    if (noteId !== null) {
      const note = notes.find((n) => n._id === noteId) ?? sharedNotes?.find((n) => n._id === noteId);
      if (!note) return;
      const ack = lastAcknowledged.current;
      if (
        ack &&
        ack.title === note.title &&
        ack.content === note.content &&
        arraysEqual(ack.tagIds, note.tagIds ?? [])
      )
        return;

      // Remote/other-user updates: only sync title/tags from Convex, not content
      if (collaborationToken && collaborationToken !== "loading") {
        setTitle(note.title);
        setSelectedTagIds(note.tagIds ?? []);
        lastAcknowledged.current = {
          title: note.title,
          content: note.content,
          tagIds: note.tagIds ?? [],
        };
        return;
      }

      setTitle(note.title);
      setSelectedTagIds(note.tagIds ?? []);
      try {
        setBlocks(JSON.parse(note.content));
      } catch {
        setBlocks([{ type: "paragraph" }]);
      }
      lastAcknowledged.current = {
        title: note.title,
        content: note.content,
        tagIds: note.tagIds ?? [],
      };
      setHasUncommittedChanges(false);
      setContentVersion((v) => v + 1);
      return;
    }
  }, [notes, sharedNotes, createNote, noteId, collaborationToken]);

  const flushSave = useCallback(() => {
    if (!noteId) return;
    const pending = pendingSave.current;
    if (pending.title === undefined && pending.content === undefined) return;
    const content = pending.content ?? JSON.stringify(blocks);
    lastAcknowledged.current = {
      title: pending.title ?? title,
      content,
      tagIds: lastAcknowledged.current?.tagIds ?? selectedTagIds,
    };
    updateNote({
      id: noteId as never,
      title: pending.title,
      content: pending.content,
    });
    pendingSave.current = {};
  }, [noteId, notes, blocks, title, selectedTagIds, updateNote]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, 800);
  }, [flushSave]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCollaborationToken() {
      try {
        const response = await fetch("/api/convex-token");
        if (!response.ok) {
          if (!cancelled) setCollaborationToken(null);
          return;
        }
        const body: { token: string | null } = await response.json();
        if (!cancelled) setCollaborationToken(body.token);
      } catch {
        if (!cancelled) setCollaborationToken(null);
      }
    }

    loadCollaborationToken();
    const interval = window.setInterval(loadCollaborationToken, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      if (!isOwner) return;
      setTitle(newTitle);
      pendingSave.current.title = newTitle;
      scheduleSave();
    },
    [isOwner, scheduleSave],
  );

  const handleBlocksChange = useCallback((newBlocks: PartialBlock[]) => {
    setBlocks(newBlocks);
    setHasUncommittedChanges(
      JSON.stringify(newBlocks) !== lastAcknowledged.current?.content,
    );
  }, []);

  const handleCommitSnapshot = useCallback(async () => {
    if (!noteId) return;

    const content = JSON.stringify(blocks);
    let committed = false;

    if (collab.isConnected) {
      const result = await collab.requestCommit();
      if (result.ok) {
        committed = true;
      } else {
        const fallbackSafeErrors = new Set([
          "Not connected",
          "No response",
          "Nothing to commit",
        ]);
        if (!fallbackSafeErrors.has(result.error ?? "")) {
          toast.error(result.error ?? "Failed to commit changes");
          return;
        }
      }
    }

    if (!committed) {
      try {
        await updateNote({ id: noteId as never, content });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to commit changes",
        );
        return;
      }
    }

    lastAcknowledged.current = {
      title,
      content,
      tagIds: lastAcknowledged.current?.tagIds ?? selectedTagIds,
    };
    setHasUncommittedChanges(false);
    toast.success("Changes committed");
  }, [noteId, blocks, title, selectedTagIds, collab, updateNote]);

  const handleShareNote = useCallback(
    async (targetNoteId: string, editorUserId: string) => {
      await addEditor({
        noteId: targetNoteId as never,
        editorUserId,
      });
    },
    [addEditor],
  );

  const handleCreateShareCode = useCallback(
    async (targetNoteId: string, code: string) => {
      await createShareCode({
        noteId: targetNoteId as never,
        code,
      });
    },
    [createShareCode],
  );

  const redeemedRef = useRef(false);
  useEffect(() => {
    if (!user || redeemedRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("share");
    if (!code) return;

    redeemedRef.current = true;

    redeemShareCode({ code })
      .then((result) => {
        if (result.alreadyAccess) {
          toast.info("You already have access to this note");
        } else {
          toast.success("Note added to your list");
        }
        const url = new URL(window.location.href);
        url.searchParams.delete("share");
        window.history.replaceState({}, "", url.toString());
        if (result.noteId) {
          handleSelectNote(result.noteId);
        }
      })
      .catch((err: Error) => {
        toast.error(err.message || "Failed to redeem share code");
      });
  }, [user, redeemShareCode]);

  const handleAddTag = useCallback(
    async (tagId: Id<"tags">) => {
      if (!noteId) return;
      const next = [...selectedTagIds, tagId];
      setSelectedTagIds(next);
      if (lastAcknowledged.current) lastAcknowledged.current.tagIds = next;
      try {
        await assignTag({ noteId: noteId as never, tagId });
      } catch (err) {
        // Roll back on failure so the UI doesn't lie about the persisted state.
        setSelectedTagIds(selectedTagIds);
        if (lastAcknowledged.current) {
          lastAcknowledged.current.tagIds = selectedTagIds;
        }
        toast.error(err instanceof Error ? err.message : "Failed to add tag");
      }
    },
    [noteId, selectedTagIds, assignTag],
  );

  const handleRemoveTag = useCallback(
    async (tagId: Id<"tags">) => {
      if (!noteId) return;
      const next = selectedTagIds.filter((id) => id !== tagId);
      setSelectedTagIds(next);
      if (lastAcknowledged.current) lastAcknowledged.current.tagIds = next;
      try {
        await unassignTag({ noteId: noteId as never, tagId });
      } catch (err) {
        setSelectedTagIds(selectedTagIds);
        if (lastAcknowledged.current) {
          lastAcknowledged.current.tagIds = selectedTagIds;
        }
        toast.error(err instanceof Error ? err.message : "Failed to remove tag");
      }
    },
    [noteId, selectedTagIds, unassignTag],
  );

  const handleCreateTag = useCallback(
    async (name: string) => {
      return createTag({ name, color: DEFAULT_TAG_COLOR });
    },
    [createTag],
  );

  const handleManageCreateTag = useCallback(
    async (name: string, color: string) => {
      await createTag({ name, color });
    },
    [createTag],
  );

  const handleManageUpdateTag = useCallback(
    async (id: string, name: string) => {
      await updateTag({ id: id as never, name });
    },
    [updateTag],
  );

  const handleManageChangeColor = useCallback(
    async (id: string, color: string) => {
      await updateTag({ id: id as never, color });
    },
    [updateTag],
  );

  const handleManageDeleteTag = useCallback(
    async (id: string) => {
      await deleteTag({ id: id as never });
      const next = selectedTagIds.filter((tid) => tid !== id);
      if (next.length !== selectedTagIds.length) {
        setSelectedTagIds(next);
        if (lastAcknowledged.current) {
          lastAcknowledged.current.tagIds = next;
        }
      }
    },
    [deleteTag, selectedTagIds],
  );

  const editorKey =
    noteId && collaborationToken !== "loading"
      ? `${noteId}-${contentVersion}`
      : undefined;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background h-dvh overflow-y-scroll overflow-x-clip">
      <div className="flex-1 flex flex-col p-6 pb-32 max-w-4xl w-full mx-auto">
        {editorKey ? (
          <RichTextEditor
            key={editorKey}
            noteId={noteId as Id<"notes">}
            currentUser={{
              name: user?.name ?? undefined,
              email: user?.email ?? undefined,
            }}
            content={blocks}
            onChange={handleBlocksChange}
            hasUncommittedChanges={hasUncommittedChanges}
            onCommitSnapshot={handleCommitSnapshot}
            collab={collab}
            title={title}
            onTitleChange={handleTitleChange}
            isOwner={isOwner}
            placeholder="Start writing, or type '/' for commands..."
            tags={tags ?? []}
            selectedTagIds={selectedTagIds}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onCreateTag={handleCreateTag}
            onManageTags={{
              onCreateTag: handleManageCreateTag,
              onUpdateTag: handleManageUpdateTag,
              onChangeColor: handleManageChangeColor,
              onDeleteTag: handleManageDeleteTag,
            }}
          />
        ) : (
          <NoteSkeleton />
        )}
      </div>

      {/* Progressive blur overlay */}
      <div
        aria-hidden
        className="fixed bottom-0 inset-x-0 h-28 pointer-events-none z-40"
        style={{
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          maskImage: "linear-gradient(to top, black 45%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to top, black 45%, transparent 100%)",
        }}
      />
      <div
        aria-hidden
        className="fixed bottom-0 inset-x-0 h-28 pointer-events-none z-40 bg-gradient-to-t from-background/70 to-transparent"
      />

      {/* LayoutGroup coordinates the layoutId morph between the trigger pill
          (inside the flex bar) and the expanded dialog (inside CommandPalette)
          so framer-motion treats them as one continuous animation. */}
      <LayoutGroup id="cmdk-morph">
        {/* Flex bar — pill and avatar take natural width, center section
            expands to fill the rest so justify-center places the search
            equidistant from both sides regardless of their different sizes. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 34 }}
          className="fixed bottom-4 inset-x-4 z-50 flex items-center"
        >
          {/* Left — profile pill */}
          <ProfilePill
            notes={notes ?? []}
            notesLoading={notes === undefined}
            sharedNotes={sharedNotes ?? []}
            sharedNotesLoading={sharedNotes === undefined}
            noteId={noteId}
            noteTitle={title}
            isOwner={isOwner}
            onSelectNoteAction={handleSelectNote}
            onCreateNote={handleCreateNote}
            onDeleteNote={handleDeleteNote}
            onShareNote={handleShareNote}
            onCreateShareCode={handleCreateShareCode}
          />

          {/* Centre — grows to fill remaining space, centers the trigger */}
          <div className="flex flex-1 justify-center">
            <AnimatePresence initial={false}>
              {!cmdkOpen && (
                <motion.button
                  key="cmdk-trigger"
                  layoutId="cmdk-shell"
                  onClick={() => setCmdkOpen(true)}
                  aria-label="Open command palette (⌘K)"
                  className="flex h-8 items-center gap-2 border border-border bg-surface px-3.5 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-muted/50 hover:text-foreground"
                  style={{ borderRadius: 9999 }}
                  transition={CMDK_SPRING}
                >
                  <Search className="size-3 shrink-0" />
                  <span>Search…</span>
                  <kbd className="ml-0.5 rounded border border-border/60 px-1 py-0.5 font-mono text-[10px] leading-none">
                    ⌘K
                  </kbd>
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Right — connected users */}
          <ConnectedUsers
            users={allContributors}
            className="flex -space-x-2"
          />
        </motion.div>

        {/* Command palette dialog + backdrop (trigger lives in the flex bar above) */}
        <CommandPalette
          isOpen={cmdkOpen}
          onOpen={() => setCmdkOpen(true)}
          onClose={() => setCmdkOpen(false)}
          onSelectNote={handleSelectNote}
        />
      </LayoutGroup>
    </div>
  );
}

function arraysEqual(a: Id<"tags">[], b: Id<"tags">[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}
