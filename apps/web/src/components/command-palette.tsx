"use client";

import { useEffect } from "react";
import { Command } from "cmdk";
import { Modal, useOverlayState } from "@heroui/react";
import { useTheme } from "next-themes";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useQuery } from "convex/react";
import { api } from "@noteey/backend/convex/_generated/api";
import { Check, FileText, LogOut, Monitor, Moon, Search, Sun } from "lucide-react";

export function CommandPalette() {
  const state = useOverlayState();
  const { setTheme, theme } = useTheme();
  const { user } = useUser();
  const notes = useQuery(api.notes.list);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        state.open();
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [state]);

  const runCommand = (fn: () => void) => {
    state.close();
    fn();
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="sm">
          <Modal.Dialog className="overflow-hidden rounded-xl p-0">
            <Command
              label="Command Palette"
              className="flex flex-col"
            >
              <div className="flex items-center border-b border-border px-3">
                <Search className="mr-2 size-4 shrink-0 text-muted-foreground" />
                <Command.Input
                  placeholder="Type a command or search…"
                  className="flex h-11 w-full bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
              <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-2">
                <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                  No results found.
                </Command.Empty>

                <Command.Group
                  heading="Theme"
                  className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground [&_[data-cmdk-group-heading]]:px-2 [&_[data-cmdk-group-heading]]:py-1 [&_[data-cmdk-group-heading]]:text-xs [&_[data-cmdk-group-heading]]:font-medium [&_[data-cmdk-group-heading]]:text-muted-foreground"
                >
                  <PaletteItem
                    onSelect={() => runCommand(() => setTheme("light"))}
                  >
                    <Sun className="mr-2 size-4" />
                    Light
                    {theme === "light" && <Check className="ml-auto size-4 text-muted-foreground" />}
                  </PaletteItem>
                  <PaletteItem
                    onSelect={() => runCommand(() => setTheme("dark"))}
                  >
                    <Moon className="mr-2 size-4" />
                    Dark
                    {theme === "dark" && <Check className="ml-auto size-4 text-muted-foreground" />}
                  </PaletteItem>
                  <PaletteItem
                    onSelect={() => runCommand(() => setTheme("system"))}
                  >
                    <Monitor className="mr-2 size-4" />
                    System
                    {theme === "system" && <Check className="ml-auto size-4 text-muted-foreground" />}
                  </PaletteItem>
                </Command.Group>

                <Command.Separator className="-mx-2 my-1 h-px bg-border" />

                {notes && notes.length > 0 && (
                  <>
                    <Command.Group
                      heading="Notes"
                      className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground [&_[data-cmdk-group-heading]]:px-2 [&_[data-cmdk-group-heading]]:py-1 [&_[data-cmdk-group-heading]]:text-xs [&_[data-cmdk-group-heading]]:font-medium [&_[data-cmdk-group-heading]]:text-muted-foreground"
                    >
                      {notes.map((note) => (
                        <PaletteItem
                          key={note._id}
                          value={note.title}
                          keywords={[note.title]}
                          onSelect={() => state.close()}
                        >
                          <FileText className="mr-2 size-4" />
                          <span className="truncate">{note.title}</span>
                        </PaletteItem>
                      ))}
                    </Command.Group>
                    <Command.Separator className="-mx-2 my-1 h-px bg-border" />
                  </>
                )}

                {user && (
                  <Command.Group
                    heading="Account"
                    className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground [&_[data-cmdk-group-heading]]:px-2 [&_[data-cmdk-group-heading]]:py-1 [&_[data-cmdk-group-heading]]:text-xs [&_[data-cmdk-group-heading]]:font-medium [&_[data-cmdk-group-heading]]:text-muted-foreground"
                  >
                    <PaletteItem
                      onSelect={() => {
                        state.close();
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
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
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
        transition-colors duration-200
        data-[selected=true]:bg-muted/40
        [&_[data-cmdk-item-content]]:flex [&_[data-cmdk-item-content]]:w-full [&_[data-cmdk-item-content]]:items-center
        ${className ?? ""}`}
      {...props}
    >
      {children}
    </Command.Item>
  );
}
