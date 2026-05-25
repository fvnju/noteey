"use client";

import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Command } from "cmdk";
import { useTheme } from "next-themes";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useQuery } from "convex/react";
import { api } from "@noteey/backend/convex/_generated/api";
import {
  Check,
  FileText,
  LogOut,
  Monitor,
  Moon,
  Sun,
  Tag,
  Users,
} from "lucide-react";

// Shared group heading style
const GROUP_CLASS =
  "[&_[data-cmdk-group-heading]]:px-2 [&_[data-cmdk-group-heading]]:py-1 " +
  "[&_[data-cmdk-group-heading]]:text-xs [&_[data-cmdk-group-heading]]:font-medium " +
  "[&_[data-cmdk-group-heading]]:text-muted-foreground px-2 pt-2 pb-1";

export const CMDK_SPRING = {
  type: "spring",
  stiffness: 420,
  damping: 38,
} as const;

type CommandPaletteProps = {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelectNote?: (id: string) => void;
};

export function CommandPalette({ isOpen, onOpen, onClose, onSelectNote }: CommandPaletteProps) {
  const { setTheme, theme } = useTheme();
  const { user } = useUser();
  const notes = useQuery(api.notes.list);
  const sharedNotes = useQuery(api.notes.listSharedWithMe);
  const tags = useQuery(api.tags.list);
  const inputRef = useRef<HTMLInputElement>(null);

  const tagNameById = useMemo(() => {
    const map = new Map<string, string>();
    if (tags) {
      for (const tag of tags) {
        map.set(tag._id, tag.name);
      }
    }
    return map;
  }, [tags]);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        isOpen ? onClose() : onOpen();
      }
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onOpen, onClose]);

  // Auto-focus — 60 ms lets the morph spring get underway first
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [isOpen]);

  const runCommand = (fn: () => void) => {
    onClose();
    fn();
  };

  return (
    <>
      {/* Dimmed backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="cmdk-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[48] bg-black/15"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Expanded dialog — shares layoutId with the trigger pill in page.tsx */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="cmdk-dialog"
            layoutId="cmdk-shell"
            className="fixed bottom-4 left-0 right-0 mx-auto z-[51] w-[min(calc(100vw-2rem),24rem)] overflow-hidden border border-border bg-surface shadow-2xl"
            style={{ borderRadius: 16 }}
            transition={CMDK_SPRING}
          >
            <Command label="Command Palette" className="flex flex-col">
              <div className="flex items-center border-b border-border px-3">
                <motion.svg
                  layoutId="cmdk-search-icon"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2 size-4 shrink-0 text-muted-foreground"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </motion.svg>
                <Command.Input
                  ref={inputRef}
                  placeholder="Type a command or search…"
                  className="flex h-11 w-full bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>

              <Command.List className="max-h-72 overflow-y-auto overflow-x-hidden p-2">
                <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                  No results found.
                </Command.Empty>

                <Command.Group heading="Theme" className={GROUP_CLASS}>
                  <PaletteItem onSelect={() => runCommand(() => setTheme("light"))}>
                    <Sun className="mr-2 size-4" />
                    Light
                    {theme === "light" && (
                      <Check className="ml-auto size-4 text-muted-foreground" />
                    )}
                  </PaletteItem>
                  <PaletteItem onSelect={() => runCommand(() => setTheme("dark"))}>
                    <Moon className="mr-2 size-4" />
                    Dark
                    {theme === "dark" && (
                      <Check className="ml-auto size-4 text-muted-foreground" />
                    )}
                  </PaletteItem>
                  <PaletteItem onSelect={() => runCommand(() => setTheme("system"))}>
                    <Monitor className="mr-2 size-4" />
                    System
                    {theme === "system" && (
                      <Check className="ml-auto size-4 text-muted-foreground" />
                    )}
                  </PaletteItem>
                </Command.Group>

                <Command.Separator className="-mx-2 my-1 h-px bg-border" />

                {notes && notes.length > 0 && (
                  <>
                    <Command.Group heading="My Notes" className={GROUP_CLASS}>
                      {notes.map((note) => {
                        const noteTagNames = (note.tagIds ?? [])
                          .map((id) => tagNameById.get(id))
                          .filter(Boolean) as string[];
                        return (
                          <PaletteItem
                            key={note._id}
                            value={note.title}
                            keywords={[note.title, ...noteTagNames]}
                            onSelect={() => {
                              onClose();
                              onSelectNote?.(note._id);
                            }}
                          >
                            <FileText className="mr-2 size-4 shrink-0" />
                            <span className="min-w-0 truncate">{note.title}</span>
                            {noteTagNames.length > 0 && (
                              <span className="ml-auto flex shrink-0 items-center gap-1 pl-2">
                                <Tag className="size-3 text-muted-foreground" />
                                <span className="max-w-[6rem] truncate text-xs text-muted-foreground">
                                  {noteTagNames.join(", ")}
                                </span>
                              </span>
                            )}
                          </PaletteItem>
                        );
                      })}
                    </Command.Group>
                    <Command.Separator className="-mx-2 my-1 h-px bg-border" />
                  </>
                )}

                {sharedNotes && sharedNotes.length > 0 && (
                  <>
                    <Command.Group heading="Shared with Me" className={GROUP_CLASS}>
                      {sharedNotes.map((note) => {
                        const noteTagNames = (note.tagIds ?? [])
                          .map((id) => tagNameById.get(id))
                          .filter(Boolean) as string[];
                        return (
                          <PaletteItem
                            key={note._id}
                            value={note.title}
                            keywords={[
                              note.title,
                              note.ownerName ?? "",
                              ...noteTagNames,
                            ]}
                            onSelect={() => {
                              onClose();
                              onSelectNote?.(note._id);
                            }}
                          >
                            <Users className="mr-2 size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex flex-col">
                              <span className="truncate">{note.title}</span>
                              <span className="truncate text-xs text-muted-foreground">
                                {note.ownerName}
                              </span>
                            </div>
                            {noteTagNames.length > 0 && (
                              <span className="ml-auto flex shrink-0 items-center gap-1 pl-2">
                                <Tag className="size-3 text-muted-foreground" />
                                <span className="max-w-[6rem] truncate text-xs text-muted-foreground">
                                  {noteTagNames.join(", ")}
                                </span>
                              </span>
                            )}
                          </PaletteItem>
                        );
                      })}
                    </Command.Group>
                    <Command.Separator className="-mx-2 my-1 h-px bg-border" />
                  </>
                )}

                {user && (
                  <Command.Group heading="Account" className={GROUP_CLASS}>
                    <PaletteItem
                      onSelect={() => {
                        onClose();
                        window.location.href = "/auth/logout";
                      }}
                    >
                      <LogOut className="mr-2 size-4" />
                      Sign out
                    </PaletteItem>
                  </Command.Group>
                )}
              </Command.List>
            </Command>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function PaletteItem({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Command.Item>) {
  return (
    <Command.Item
      className={`flex cursor-pointer items-center rounded-lg px-2 py-2 text-sm text-foreground
        transition-colors duration-150
        data-[selected=true]:bg-muted/40
        [&_[data-cmdk-item-content]]:flex [&_[data-cmdk-item-content]]:w-full [&_[data-cmdk-item-content]]:items-center
        ${className ?? ""}`}
      {...props}
    >
      {children}
    </Command.Item>
  );
}
