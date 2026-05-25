"use client";

import { useEffect, useRef, useState } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { Button, Spinner } from "@heroui/react";
import type { PartialBlock } from "@blocknote/core";
import { Lock } from "lucide-react";
import { useTheme } from "next-themes";
import type { Doc, Id } from "@noteey/backend/convex/_generated/dataModel";
import { useCollabSocket } from "@/lib/use-collab-socket";
import { useRemoteCursors } from "@/lib/use-remote-cursors";
import type { UseCollabSocketReturn } from "@/lib/use-collab-socket";
import { RemoteCursorsLayer } from "./remote-cursors-layer";
import "@blocknote/mantine/style.css";
import "./blocknote-theme.css";
import { TagInput } from "@/components/tag-input";
import { TagManager } from "@/components/tag-manager";

type RichTextEditorProps = {
  noteId?: Id<"notes"> | null;
  collaborationToken?: string | null;
  realtimeUrl?: string;
  currentUser?: { name?: string; email?: string };
  content?: PartialBlock[];
  onChange?: (blocks: PartialBlock[]) => void;
  hasUncommittedChanges?: boolean;
  onCommitSnapshot?: () => Promise<void>;
  collab?: UseCollabSocketReturn;
  placeholder?: string;
  title?: string;
  onTitleChange?: (title: string) => void;
  autoFocusTitle?: boolean;
  onTitleFocused?: () => void;
  isOwner?: boolean;
  tags?: Doc<"tags">[];
  selectedTagIds?: Id<"tags">[];
  onAddTag?: (tagId: Id<"tags">) => void;
  onRemoveTag?: (tagId: Id<"tags">) => void;
  onCreateTag?: (name: string) => Promise<Id<"tags"> | undefined>;
  onManageTags?: {
    onCreateTag: (name: string, color: string) => Promise<void>;
    onUpdateTag: (id: string, name: string) => Promise<void>;
    onChangeColor: (id: string, color: string) => Promise<void>;
    onDeleteTag: (id: string) => Promise<void>;
  };
};

export function RichTextEditor({
  noteId,
  collaborationToken,
  realtimeUrl = "ws://localhost:1235",
  content,
  onChange,
  hasUncommittedChanges = false,
  onCommitSnapshot,
  collab: collabProp,
  placeholder = "Start writing, or type '/' for commands...",
  title,
  onTitleChange,
  autoFocusTitle = false,
  onTitleFocused,
  isOwner = true,
  tags,
  selectedTagIds,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  onManageTags,
}: RichTextEditorProps) {
  const { resolvedTheme } = useTheme();
  const [localTitle, setLocalTitle] = useState(title ?? "");
  const [isCommitting, setIsCommitting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const remoteUpdateRef = useRef(false);

  const _internalCollab = useCollabSocket({
    noteId: noteId ?? null,
    token: collaborationToken ?? null,
    realtimeUrl,
  });
  const collab = collabProp ?? _internalCollab;

  const editor = useCreateBlockNote({
    initialContent:
      content && content.length > 0 ? content : [{ type: "paragraph" }],
    placeholders: {
      default: placeholder,
    },
    animations: false,
  });

  const { overlayRef, cursors } = useRemoteCursors({
    editor,
    remoteSelections: collab.remoteCursors,
    onCursorChange: collab.sendCursor,
  });

  useEffect(() => {
    return collab.onRemoteDocUpdate((remoteContent: string) => {
      try {
        const blocks: PartialBlock[] = JSON.parse(remoteContent);
        if (blocks.length === 0) return;
        remoteUpdateRef.current = true;
        const currentIds = editor.document.map((b) => b.id);
        editor.replaceBlocks(currentIds, blocks);
      } catch {
        // ignore malformed content
      }
    });
  }, [collab.onRemoteDocUpdate, editor]);

  useEffect(() => {
    if (!collab.bufferedContent) return;
    try {
      const blocks: PartialBlock[] = JSON.parse(collab.bufferedContent);
      if (blocks.length === 0) return;
      remoteUpdateRef.current = true;
      const currentIds = editor.document.map((b) => b.id);
      editor.replaceBlocks(currentIds, blocks);
    } catch {
      // ignore malformed content
    }
  }, [collab.bufferedContent, editor]);

  useEffect(() => {
    if (autoFocusTitle && titleRef.current && isOwner) {
      titleRef.current.focus();
      titleRef.current.select();
    }
  }, [autoFocusTitle, isOwner]);

  const handleCommit = async () => {
    if (!onCommitSnapshot) return;
    setIsCommitting(true);
    try {
      await onCommitSnapshot();
    } finally {
      setIsCommitting(false);
    }
  };

  const titleValue = onTitleChange ? (title ?? "") : localTitle;
  const titleEditable = isOwner;

  return (
    <div className="flex-1 bg-background rounded-lg overflow-hidden flex flex-col">
      <div className="shrink-0 px-4 md:px-13.5 pt-8 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {!titleEditable && (
              <Lock
                aria-label="Title is read-only — only the note owner can edit"
                className="shrink-0 size-5 text-muted-foreground/60"
                strokeWidth={2.25}
              />
            )}
            <input
              ref={titleRef}
              type="text"
              value={titleValue}
              readOnly={!titleEditable}
              aria-readonly={!titleEditable}
              title={
                titleEditable
                  ? undefined
                  : "Only the note owner can edit the title"
              }
              onFocus={onTitleFocused}
              onChange={(e) => {
                if (!titleEditable) return;
                if (onTitleChange) {
                  onTitleChange(e.target.value);
                } else {
                  setLocalTitle(e.target.value);
                }
              }}
              placeholder="Untitled"
              className={`flex-1 min-w-0 text-3xl font-bold bg-transparent text-foreground placeholder:text-muted-foreground/40 outline-none ${
                titleEditable ? "" : "cursor-default select-text"
              }`}
            />
          </div>
          {onCommitSnapshot && (
            <Button
              className="mt-1 shrink-0"
              variant="primary"
              isDisabled={
                isCommitting ||
                collab.isCommitting ||
                !hasUncommittedChanges
              }
              isPending={isCommitting || collab.isCommitting}
              onPress={handleCommit}
            >
              {({ isPending }) => (
                <>
                  {isPending ? <Spinner color="current" size="sm" /> : null}
                  {isCommitting || collab.isCommitting ? "Saving…" : "Commit"}
                </>
              )}
            </Button>
          )}
        </div>
        {tags && selectedTagIds && onAddTag && onRemoveTag && onCreateTag && (
          <div className="mt-3 flex min-h-8 items-center gap-2">
            <div className="min-w-0 flex-1">
              <TagInput
                tags={tags}
                selectedTagIds={selectedTagIds}
                onAddTag={onAddTag}
                onRemoveTag={onRemoveTag}
                onCreateTag={onCreateTag}
              />
            </div>
            {onManageTags && (
              <TagManager
                tags={tags}
                onCreateTag={onManageTags.onCreateTag}
                onUpdateTag={onManageTags.onUpdateTag}
                onChangeColor={onManageTags.onChangeColor}
                onDeleteTag={onManageTags.onDeleteTag}
              />
            )}
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 flex flex-col bg-surface rounded-xl relative">
        <BlockNoteView
          editor={editor}
          theme={resolvedTheme === "dark" ? "dark" : "light"}
          onChange={() => {
            if (remoteUpdateRef.current) {
              remoteUpdateRef.current = false;
              return;
            }
            onChange?.(editor.document);
            collab.sendDocUpdate(JSON.stringify(editor.document));
          }}
          className="flex-1 rounded-xl"
        />
        <div ref={overlayRef}>
          <RemoteCursorsLayer cursors={cursors} />
        </div>
      </div>
    </div>
  );
}
