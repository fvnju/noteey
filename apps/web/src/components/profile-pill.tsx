"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { Button } from "@heroui/react/button";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownPopover,
  DropdownSection,
  DropdownSubmenuIndicator,
  DropdownSubmenuTrigger,
  DropdownTrigger,
} from "@heroui/react/dropdown";
import { Separator } from "@heroui/react/separator";
import { Skeleton } from "@heroui/react/skeleton";
import { TextShimmer } from "@/components/text-shimmer";
import { AnimatedBackground } from "@/components/animated-background";
import { motion, type PanInfo } from "framer-motion";
import {
  Check,
  ChevronDown,
  FileText,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Share2,
  Sun,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { Input, InputGroup, Modal, Tabs, useOverlayState } from "@heroui/react";
import { toast } from "@heroui/react";
import { useTheme } from "next-themes";
import type { Doc } from "@noteey/backend/convex/_generated/dataModel";

type ProfilePillProps = {
  notes?: Doc<"notes">[];
  notesLoading?: boolean;
  sharedNotes?: Doc<"notes">[];
  sharedNotesLoading?: boolean;
  noteId?: string | null;
  noteTitle?: string;
  isOwner?: boolean;
  onSelectNoteAction?: (id: string) => void;
  onCreateNote?: () => void;
  onDeleteNote?: (id: string) => void;
  onShareNote?: (noteId: string, editorUserId: string) => Promise<void>;
  onCreateShareCode?: (noteId: string, code: string) => Promise<void>;
};

const EMPTY_NOTES: Doc<"notes">[] = [];

function generateShareCode(): string {
  return `${Date.now().toString(36).slice(-4)}${Math.random().toString(36).substring(2, 6)}`.toUpperCase();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

const PAGE_SLIDE_TRANSITION_STYLES = `
:root {
  --page-slide-dur: 200ms;
  --page-fade-dur: 200ms;
  --page-slide-distance: 8px;
  --page-blur: 3px;
  --page-stagger: 0ms;
  --page-exit-enabled: 1;
  --page-slide-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --page-fade-ease: cubic-bezier(0.22, 1, 0.36, 1);
}

.t-page-slide {
  position: relative;
}
.t-page-slide .t-page[data-page-id="1"] {
  --t-page-from-x: calc(var(--page-slide-distance) * -1);
}
.t-page-slide .t-page[data-page-id="2"] {
  --t-page-from-x: var(--page-slide-distance);
}
.t-page-slide .t-page {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  transform: translateX(calc(var(--t-page-from-x, 0px) * var(--page-exit-enabled)));
  filter: blur(calc(var(--page-blur) * var(--page-exit-enabled)));
  transition:
    opacity var(--page-fade-dur) var(--page-fade-ease),
    transform var(--page-slide-dur) var(--page-slide-ease),
    filter var(--page-slide-dur) var(--page-slide-ease);
  will-change: opacity, transform, filter;
}
.t-page-slide[data-page="1"] .t-page[data-page-id="1"],
.t-page-slide[data-page="2"] .t-page[data-page-id="2"] {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0);
  filter: blur(0);
  transition-delay: var(--page-stagger);
}

@media (prefers-reduced-motion: reduce) {
  .t-page-slide .t-page { transition: none !important; }
}
`;

const TEXT_SWAP_TRANSITION_STYLES = `
:root {
  --text-swap-dur: 150ms;
  --text-swap-translate-y: 4px;
  --text-swap-blur: 2px;
  --text-swap-ease: ease-in-out;
}

.t-text-swap {
  display: inline-block;
  transform: translateY(0);
  filter: blur(0);
  opacity: 1;
  transition:
    transform var(--text-swap-dur) var(--text-swap-ease),
    filter var(--text-swap-dur) var(--text-swap-ease),
    opacity var(--text-swap-dur) var(--text-swap-ease);
  will-change: transform, filter, opacity;
}
.t-text-swap.is-exit {
  transform: translateY(calc(var(--text-swap-translate-y) * -1));
  filter: blur(var(--text-swap-blur));
  opacity: 0;
}
.t-text-swap.is-enter-start {
  transform: translateY(var(--text-swap-translate-y));
  filter: blur(var(--text-swap-blur));
  opacity: 0;
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .t-text-swap { transition: none !important; }
}
`;

function readCssMs(name: string, fallback: number): number {
  if (typeof document === "undefined") return fallback;

  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  const value = Number.parseFloat(raw);

  return Number.isFinite(value) ? value : fallback;
}

/**
 * Calculates the rendered pixel width of the profile pill for a given username.
 *
 * Breakdown (px):
 *   left-pad(8) + avatar(24) + gap(8) + text + gap(8) + chevron(12) + right-pad(8) + border(2)
 *   = 70 + measured text width
 *
 * Capped at the max-w-32 truncation limit (128px of text = ~198px total) to match
 * the `max-w-32 truncate` on the username span.
 */
export function pillWidthFor(name: string): number {
  if (typeof document === "undefined") return 70; // SSR guard
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return 70;
  const fontFamily = getComputedStyle(document.body).fontFamily;
  ctx.font = `12px ${fontFamily}`;
  // max-w-32 = 8rem = 128px — clamp to match the span's truncation
  const textWidth = Math.min(ctx.measureText(name).width, 128);
  return Math.ceil(70 + textWidth);
}

export function ProfilePill({
  notes = EMPTY_NOTES,
  notesLoading = false,
  sharedNotes = EMPTY_NOTES,
  sharedNotesLoading = false,
  noteId,
  noteTitle,
  isOwner = false,
  onSelectNoteAction: onSelectNote,
  onCreateNote,
  onDeleteNote,
  onShareNote,
  onCreateShareCode,
}: ProfilePillProps) {
  const { user, isLoading } = useUser();
  const { theme, setTheme } = useTheme();
  const shareState = useOverlayState();
  const [shareMode, setShareMode] = useState<"userId" | "link">("userId");
  const [shareUserId, setShareUserId] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const generateLinkTextRef = useRef<HTMLSpanElement | null>(null);
  const shareLinkContentRef = useRef<HTMLDivElement | null>(null);
  const [generateLinkText, setGenerateLinkText] = useState(
    "Generate Share Link",
  );
  const [showGeneratedLink, setShowGeneratedLink] = useState(false);

  useEffect(() => {
    const nextText = isGeneratingLink ? "Generating…" : "Generate Share Link";

    if (nextText === generateLinkText) return;

    const textElement = generateLinkTextRef.current;
    if (!textElement) {
      setGenerateLinkText(nextText);
      return;
    }

    const duration = readCssMs("--text-swap-dur", 150);
    textElement.classList.add("is-exit");

    const timeout = window.setTimeout(() => {
      setGenerateLinkText(nextText);
      textElement.classList.remove("is-exit");
      textElement.classList.add("is-enter-start");
      void textElement.offsetWidth;
      textElement.classList.remove("is-enter-start");
    }, duration);

    return () => {
      window.clearTimeout(timeout);
      textElement.classList.remove("is-exit", "is-enter-start");
    };
  }, [generateLinkText, isGeneratingLink]);

  useEffect(() => {
    const nextShowGeneratedLink = shareCode != null;

    if (nextShowGeneratedLink === showGeneratedLink) return;

    const contentElement = shareLinkContentRef.current;
    if (!contentElement) {
      setShowGeneratedLink(nextShowGeneratedLink);
      return;
    }

    const duration = readCssMs("--text-swap-dur", 150);
    contentElement.classList.add("is-exit");

    const timeout = window.setTimeout(() => {
      setShowGeneratedLink(nextShowGeneratedLink);
      contentElement.classList.remove("is-exit");
      contentElement.classList.add("is-enter-start");
      void contentElement.offsetWidth;
      contentElement.classList.remove("is-enter-start");
    }, duration);

    return () => {
      window.clearTimeout(timeout);
      contentElement.classList.remove("is-exit", "is-enter-start");
    };
  }, [shareCode, showGeneratedLink]);

  const handleSelectNote = useCallback(
    (id: string) => {
      onSelectNote?.(id);
    },
    [onSelectNote],
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
        <div className="size-6 animate-pulse rounded-full bg-muted-foreground/20" />
        <div className="h-3 w-16 animate-pulse rounded bg-muted-foreground/20" />
      </div>
    );
  }

  if (!user) {
    return (
      <a href="/auth/login">
        <Button variant="outline" className="rounded-full text-xs">
          Sign in
        </Button>
      </a>
    );
  }

  const hasNote = noteId != null;

  return (
    <Dropdown>
      <DropdownTrigger
        className={[
          "h-auto gap-2 rounded-full px-2 py-1.5 text-xs",
          "inline-flex items-center",
          "bg-surface border border-border shadow-sm",
        ].join(" ")}
      >
        {user.picture ? (
          <img
            src={user.picture}
            alt={user.name ?? ""}
            className="size-6 rounded-full"
          />
        ) : (
          <div className="flex size-6 items-center justify-center rounded-full bg-muted">
            <User className="size-3" />
          </div>
        )}
        <span className="max-w-32 truncate">{user.name}</span>
        <ChevronDown className="size-3 text-muted-foreground" />
      </DropdownTrigger>
      <DropdownPopover placement="top start" crossOffset={-4}>
        <DropdownMenu>
          <DropdownSection>
            <header className="px-2 py-2 text-xs">
              <p className="font-medium text-foreground">{user.name}</p>
              <p className="text-[10px] text-muted-foreground">{user.email}</p>
            </header>
          </DropdownSection>
          <Separator />
          <DropdownSection>
            <DropdownSubmenuTrigger>
              <DropdownItem
                id="my-notes"
                textValue="My Notes"
                className={hasNote ? "text-primary" : undefined}
              >
                <FileText className="size-3.5" />
                {notesLoading && !hasNote ? (
                  <TextShimmer as="span" className="text-xs">
                    My Notes
                  </TextShimmer>
                ) : (
                  <span className="truncate max-w-36">
                    {hasNote ? noteTitle : "My Notes"}
                  </span>
                )}
                <DropdownSubmenuIndicator />
              </DropdownItem>
              <DropdownPopover placement="right top" className="min-w-48">
                <DropdownMenu
                  onAction={(key) => {
                    if (key === "new-note") {
                      onCreateNote?.();
                    } else {
                      handleSelectNote(key as string);
                    }
                  }}
                >
                  <DropdownItem
                    id="new-note"
                    textValue="New note"
                    isDisabled={notesLoading}
                  >
                    <Plus className="size-3.5" />
                    New note
                  </DropdownItem>
                  {notes.length > 0 && <Separator />}
                  {notesLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <DropdownItem key={`skel-${i}`} textValue="" isDisabled>
                        <div className="flex items-center gap-2 w-full">
                          <Skeleton
                            className="size-3.5 shrink-0 rounded"
                            animationType="shimmer"
                          />
                          <Skeleton
                            className="h-3 rounded"
                            animationType="shimmer"
                            style={{ width: `${Math.max(40, 100 - i * 15)}%` }}
                          />
                        </div>
                      </DropdownItem>
                    ))
                  ) : notes.length === 0 ? (
                    <DropdownItem id="empty" textValue="No notes" isDisabled>
                      No notes yet
                    </DropdownItem>
                  ) : (
                    notes.map((note) => (
                      <NoteItem
                        key={note._id}
                        note={note}
                        isSelected={noteId === note._id}
                        onDelete={() => onDeleteNote?.(note._id)}
                        canDelete
                      />
                    ))
                  )}
                </DropdownMenu>
              </DropdownPopover>
            </DropdownSubmenuTrigger>
            {hasNote && isOwner && onShareNote && (
              <DropdownItem
                id="share-note"
                textValue="Share note"
                onAction={() => shareState.open()}
              >
                <Share2 className="size-3.5" />
                Share note
              </DropdownItem>
            )}
            <DropdownSubmenuTrigger>
              <DropdownItem id="shared" textValue="Shared with me">
                <Users className="size-3.5" />
                {sharedNotesLoading ? (
                  <TextShimmer as="span" className="text-xs">
                    Shared with me
                  </TextShimmer>
                ) : (
                  "Shared with me"
                )}
                <DropdownSubmenuIndicator />
              </DropdownItem>
              <DropdownPopover placement="right top" className="min-w-48">
                <DropdownMenu
                  onAction={(key) => handleSelectNote(key as string)}
                >
                  {sharedNotesLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <DropdownItem
                        key={`shared-skel-${i}`}
                        textValue=""
                        isDisabled
                      >
                        <div className="flex items-center gap-2 w-full">
                          <Skeleton
                            className="size-3.5 shrink-0 rounded"
                            animationType="shimmer"
                          />
                          <Skeleton
                            className="h-3 rounded"
                            animationType="shimmer"
                            style={{ width: `${Math.max(40, 100 - i * 15)}%` }}
                          />
                        </div>
                      </DropdownItem>
                    ))
                  ) : sharedNotes.length === 0 ? (
                    <DropdownItem
                      id="empty-shared"
                      textValue="No shared notes"
                      isDisabled
                    >
                      No shared notes
                    </DropdownItem>
                  ) : (
                    sharedNotes.map((note) => (
                      <NoteItem
                        key={note._id}
                        note={note}
                        isSelected={noteId === note._id}
                      />
                    ))
                  )}
                </DropdownMenu>
              </DropdownPopover>
            </DropdownSubmenuTrigger>
          </DropdownSection>
          <Separator />
          <DropdownItem
            id="light"
            textValue="Light"
            onAction={() => setTheme("light")}
          >
            <Sun className="size-3.5" />
            Light
            {theme === "light" && <Check className="ml-auto size-3.5" />}
          </DropdownItem>
          <DropdownItem
            id="dark"
            textValue="Dark"
            onAction={() => setTheme("dark")}
          >
            <Moon className="size-3.5" />
            Dark
            {theme === "dark" && <Check className="ml-auto size-3.5" />}
          </DropdownItem>
          <DropdownItem
            id="system"
            textValue="System"
            onAction={() => setTheme("system")}
          >
            <Monitor className="size-3.5" />
            System
            {theme === "system" && <Check className="ml-auto size-3.5" />}
          </DropdownItem>
          <Separator />
          <DropdownItem id="logout" textValue="Sign out" href="/auth/logout">
            <LogOut className="size-3.5" />
            Sign out
          </DropdownItem>
        </DropdownMenu>
      </DropdownPopover>
      {hasNote && onShareNote && (
        <Modal state={shareState}>
          <Modal.Backdrop>
            <Modal.Container placement="center" size="sm">
              <Modal.Dialog className="overflow-hidden rounded-xl p-6 max-w-sm w-full mx-4">
                <style>{PAGE_SLIDE_TRANSITION_STYLES}</style>
                <style>{TEXT_SWAP_TRANSITION_STYLES}</style>
                <h2 className="text-lg font-semibold text-foreground mb-1">
                  Share note
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Share &ldquo;{noteTitle || "Untitled"}&rdquo; with a
                  collaborator.
                </p>
                <Tabs className="w-full flex flex-col justify-center">
                  <Tabs.ListContainer className="w-[calc(100%-16px)] mx-auto">
                    <Tabs.List aria-label="Share options">
                      <Tabs.Tab
                        id="user-id"
                        onPress={() => {
                          setShareMode("userId");
                          setShareCode(null);
                        }}
                      >
                        User ID
                        <Tabs.Indicator />
                      </Tabs.Tab>
                      <Tabs.Tab
                        id="share-link"
                        onPress={() => {
                          setShareMode("link");
                          setShareUserId("");
                        }}
                      >
                        Share Link
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    </Tabs.List>
                  </Tabs.ListContainer>

                  <div
                    className="t-page-slide mt-4 min-h-[132px] w-full overflow-hidden"
                    data-page={shareMode === "userId" ? 1 : 2}
                  >
                    <Tabs.Panel
                      id="user-id"
                      className="t-page w-full"
                      data-page-id="1"
                    >
                      <Input
                        className="w-full rounded-full"
                        value={shareUserId}
                        disabled={isSharing}
                        onChange={(e) => setShareUserId(e.target.value)}
                        placeholder="Enter user ID"
                      />
                      <div className="flex justify-end gap-2 mt-4">
                        <Button
                          variant="ghost"
                          isDisabled={isSharing}
                          onPress={() => {
                            shareState.close();
                            setShareUserId("");
                            setShareMode("userId");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          isDisabled={!shareUserId.trim() || isSharing}
                          isPending={isSharing}
                          onPress={async () => {
                            if (!noteId || !shareUserId.trim() || !onShareNote)
                              return;
                            setIsSharing(true);
                            try {
                              await onShareNote(noteId, shareUserId.trim());
                              toast.success("Note shared successfully");
                              shareState.close();
                              setShareUserId("");
                            } catch (error) {
                              toast.danger(
                                error instanceof Error
                                  ? error.message
                                  : "Failed to share note",
                              );
                            } finally {
                              setIsSharing(false);
                            }
                          }}
                        >
                          {isSharing ? "Sharing…" : "Share"}
                        </Button>
                      </div>
                    </Tabs.Panel>

                    <Tabs.Panel
                      id="share-link"
                      className="t-page"
                      data-page-id="2"
                    >
                      <div
                        ref={shareLinkContentRef}
                        className="t-text-swap w-full"
                      >
                        {showGeneratedLink ? (
                          <div className="flex flex-col gap-3">
                            <InputGroup className="rounded-full">
                              <InputGroup.Input
                                value={shareUrl}
                                readOnly
                                className="truncate"
                              />
                              <InputGroup.Suffix>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onPress={async () => {
                                    await navigator.clipboard.writeText(
                                      shareUrl,
                                    );
                                    toast.success("Link copied to clipboard");
                                  }}
                                >
                                  Copy
                                </Button>
                              </InputGroup.Suffix>
                            </InputGroup>

                            <p className="text-xs text-muted-foreground">
                              Anyone with this link can edit this note.
                            </p>
                          </div>
                        ) : (
                          <Button
                            variant="primary"
                            className="w-full"
                            isPending={isGeneratingLink}
                            onPress={async () => {
                              if (!noteId || !onCreateShareCode) return;
                              setIsGeneratingLink(true);
                              try {
                                await delay(700);
                                const code = generateShareCode();
                                await onCreateShareCode(noteId, code);
                                const url = `${window.location.origin}${window.location.pathname}?share=${code}`;
                                setShareCode(code);
                                setShareUrl(url);
                              } catch {
                                const newCode = generateShareCode();
                                await onCreateShareCode!(noteId, newCode);
                                const url = `${window.location.origin}${window.location.pathname}?share=${newCode}`;
                                setShareCode(newCode);
                                setShareUrl(url);
                              } finally {
                                setIsGeneratingLink(false);
                              }
                            }}
                          >
                            <span
                              ref={generateLinkTextRef}
                              className="t-text-swap"
                            >
                              {generateLinkText}
                            </span>
                          </Button>
                        )}
                      </div>
                      <div className="flex justify-end gap-2 mt-4">
                        <Button
                          variant="ghost"
                          onPress={() => {
                            shareState.close();
                            setShareCode(null);
                            setShareUrl("");
                            setShareMode("userId");
                          }}
                        >
                          Close
                        </Button>
                      </div>
                    </Tabs.Panel>
                  </div>
                </Tabs>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      )}
    </Dropdown>
  );
}

function NoteItem({
  note,
  isSelected,
  onDelete,
  canDelete,
}: {
  note: Doc<"notes">;
  isSelected: boolean;
  onDelete?: () => void;
  canDelete?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [deleteHovered, setDeleteHovered] = useState(false);
  const [swipeOpen, setSwipeOpen] = useState(false);
  const suppressSelectRef = useRef(false);

  const closeSwipe = useCallback(() => {
    setSwipeOpen(false);
    suppressSelectRef.current = false;
  }, []);

  const handleRowTap = useCallback(() => {
    if (swipeOpen) {
      suppressSelectRef.current = true;
      closeSwipe();
    }
  }, [closeSwipe, swipeOpen]);

  const handleDragEnd = useCallback((_: PointerEvent, info: PanInfo) => {
    const shouldOpen = info.offset.x < -36 || info.velocity.x < -350;
    const shouldClose = info.offset.x > 20 || info.velocity.x > 350;

    suppressSelectRef.current = Math.abs(info.offset.x) > 8;

    if (shouldOpen) {
      setSwipeOpen(true);
      return;
    }

    if (shouldClose) {
      setSwipeOpen(false);
      return;
    }

    setSwipeOpen((open) => open && info.offset.x < 16);
  }, []);

  const handleDelete = useCallback(() => {
    closeSwipe();
    onDelete?.();
  }, [closeSwipe, onDelete]);

  return (
    <DropdownItem
      id={note._id}
      textValue={note.title}
      className="relative overflow-hidden touch-pan-y"
      onClickCapture={(event) => {
        if (suppressSelectRef.current) {
          event.preventDefault();
          event.stopPropagation();
          suppressSelectRef.current = false;
        }
      }}
    >
      {canDelete && (
        <>
          <motion.div
            className="absolute inset-0 bg-danger/10"
            initial={false}
            animate={{ scaleX: deleteHovered || swipeOpen ? 1 : 0 }}
            style={{ transformOrigin: "right center" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          />
          {onDelete && (
            <motion.button
              type="button"
              className={[
                "absolute inset-y-0 right-0 flex w-14 items-center justify-center bg-danger text-danger-foreground",
                swipeOpen ? "pointer-events-auto" : "pointer-events-none",
              ].join(" ")}
              initial={false}
              animate={{
                opacity: swipeOpen ? 1 : 0,
                x: swipeOpen ? 0 : 12,
              }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleDelete();
              }}
              aria-label={`Delete ${note.title || "Untitled"}`}
            >
              <Trash2 className="size-3.5" />
            </motion.button>
          )}
        </>
      )}
      <motion.div
        className="absolute inset-0 flex items-center px-2"
        drag={canDelete && onDelete ? "x" : false}
        dragConstraints={{ left: -56, right: 0 }}
        dragElastic={0.04}
        dragMomentum={false}
        animate={{ x: swipeOpen ? -56 : 0 }}
        transition={{ type: "spring", stiffness: 520, damping: 38 }}
        onDragStart={() => {
          suppressSelectRef.current = true;
        }}
        onDragEnd={handleDragEnd}
        onTap={handleRowTap}
        style={{ touchAction: "pan-y" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <FileText
          className={[
            "size-3.5 shrink-0 transition-colors duration-200",
            deleteHovered ? "text-danger" : "",
          ].join(" ")}
        />
        <span
          className={[
            "truncate max-w-32 ml-2 transition-colors duration-200",
            deleteHovered ? "text-danger" : "",
          ].join(" ")}
        >
          {note.title || "Untitled"}
        </span>
        <div className="relative ml-auto size-5 shrink-0">
          {isSelected && !canDelete && (
            <motion.span
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              initial={false}
              animate={{
                scale: hovered ? 0 : 1,
                opacity: hovered ? 0 : 1,
              }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
            >
              <Check className="size-3.5 text-muted-foreground" />
            </motion.span>
          )}
          {canDelete && onDelete && (
            <>
              {isSelected && (
                <motion.span
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  initial={false}
                  animate={{
                    scale: hovered ? 0 : 1,
                    opacity: hovered ? 0 : 1,
                  }}
                  transition={{ duration: 0.15, ease: "easeInOut" }}
                >
                  <Check className="size-3.5 text-muted-foreground" />
                </motion.span>
              )}
              <div
                className="absolute inset-0"
                onMouseEnter={() => setDeleteHovered(true)}
                onMouseLeave={() => setDeleteHovered(false)}
              >
                <motion.button
                  className={[
                    "absolute inset-0 flex items-center justify-center rounded transition-colors duration-200",
                    deleteHovered ? "text-danger" : "text-muted-foreground",
                  ].join(" ")}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleDelete();
                  }}
                  initial={false}
                  animate={{
                    scale: hovered ? 1 : 0,
                    opacity: hovered ? 1 : 0,
                  }}
                  transition={{
                    duration: 0.15,
                    ease: "easeInOut",
                    delay: hovered ? 0.08 : 0,
                  }}
                  aria-label={`Delete ${note.title || "Untitled"}`}
                >
                  <Trash2 className="size-3" />
                </motion.button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </DropdownItem>
  );
}
