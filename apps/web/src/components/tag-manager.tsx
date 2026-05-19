"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react/button";
import {
  ColorArea,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  Input,
  Label,
  ScrollShadow,
  Separator,
  toast,
} from "@heroui/react";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, Tag, Trash2, X } from "lucide-react";
import PenIcon from "@noteey/ui/components/pen-icon";
import type { AnimatedIconHandle } from "@noteey/ui/components/types";
import type { Doc } from "@noteey/backend/convex/_generated/dataModel";
import { useOverlayContext } from "@/lib/overlay-state";
import {
  MorphingDialog,
  MorphingDialogTrigger,
  MorphingDialogContainer,
  MorphingDialogContent,
  MorphingDialogTitle,
  useMorphingDialog,
} from "@/components/morphing-dialog";

const DEFAULT_TAG_COLOR = "hsl(222, 84%, 56%)";

const LEGACY_COLOR_CSS: Record<string, string> = {
  accent: "var(--color-accent)",
  default: "var(--color-default)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
};

const LEGACY_COLOR_VALUE: Record<string, string> = {
  accent: DEFAULT_TAG_COLOR,
  default: "hsl(215, 16%, 47%)",
  success: "hsl(142, 76%, 36%)",
  warning: "hsl(38, 92%, 50%)",
  danger: "hsl(0, 84%, 60%)",
};

const getTagColor = (color: string) => LEGACY_COLOR_CSS[color] ?? color;
const getSliderColor = (color: string) => LEGACY_COLOR_VALUE[color] ?? color;

const colorToHslString = (color: unknown) => {
  if (typeof color !== "object" || color === null) return null;
  const toString = (color as { toString?: (format: "hsl") => string }).toString;
  if (typeof toString !== "function") return null;
  const value = toString.call(color, "hsl");
  return value.startsWith("hsl") ? value : null;
};

type TagColorSliderProps = {
  tag: Doc<"tags">;
  onChangeColor: (id: string, color: string) => Promise<void>;
};

function TagColorSlider({ tag, onChangeColor }: TagColorSliderProps) {
  return (
    <ColorSlider
      key={tag.color}
      aria-label={`${tag.name} color`}
      channel="hue"
      defaultValue={getSliderColor(tag.color)}
      onChangeEnd={(color) => {
        const nextColor = colorToHslString(color);
        if (nextColor) void onChangeColor(tag._id, nextColor);
      }}
    >
      <ColorSlider.Track className="h-2 rounded-full">
        <ColorSlider.Thumb className="size-4 rounded-full border-2 border-background shadow-sm" />
      </ColorSlider.Track>
    </ColorSlider>
  );
}

type TagManagerProps = {
  tags: Doc<"tags">[];
  onCreateTag: (name: string, color: string) => Promise<void>;
  onUpdateTag: (id: string, name: string) => Promise<void>;
  onChangeColor: (id: string, color: string) => Promise<void>;
  onDeleteTag: (id: string) => Promise<void>;
};

function ColorSelectButton({
  triggerRef,
  onClose,
}: {
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  return (
    <Button
      variant="primary"
      size="sm"
      onPress={() => {
        onClose();
        triggerRef.current?.click();
      }}
      className="mt-2 w-full"
    >
      Select
    </Button>
  );
}

export function TagManager({
  tags,
  onCreateTag,
  onUpdateTag,
  onChangeColor,
  onDeleteTag,
}: TagManagerProps) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_TAG_COLOR);
  const [editingId, setEditingId] = useState<string | null>(null);
  const colorTriggerRef = useRef<HTMLButtonElement>(null);
  const { open: overlayOpen, close: overlayClose } = useOverlayContext();
  const [editName, setEditName] = useState("");
  const dialogContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // TODO: view transition fix
    try {
      toast.clear();
    } catch (e) {
      if (e instanceof Error) {
        console.error(e.message);
      }
    }
  }, []);

  const handleDialogMouseDown = useCallback((e: React.MouseEvent) => {
    // e.stopPropagation();
  }, []);

  const handleCreate = useCallback(async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (tags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.danger("A tag with this name already exists");
      return;
    }
    await onCreateTag(trimmed, newColor);
    setNewName("");
    setNewColor(DEFAULT_TAG_COLOR);
  }, [newName, newColor, onCreateTag, tags]);

  const handleStartEdit = useCallback((tag: Doc<"tags">) => {
    setEditingId(tag._id);
    setEditName(tag.name);
  }, []);

  const handleSaveEdit = useCallback(
    async (id: string) => {
      const trimmed = editName.trim();
      if (!trimmed) {
        setEditingId(null);
        return;
      }
      if (
        tags.some(
          (t) => t._id !== id && t.name.toLowerCase() === trimmed.toLowerCase(),
        )
      ) {
        toast.danger("A tag with this name already exists");
        return;
      }
      await onUpdateTag(id, trimmed);
      setEditingId(null);
    },
    [editName, onUpdateTag, tags],
  );

  return (
    <MorphingDialog>
      <MorphingDialogTrigger className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-surface px-2 py-1.5 text-xs">
        <Tag className="size-3.5" />
        <MorphingDialogTitle
          key={"manage_tag"}
          className="text-xs font-medium text-foreground"
        >
          Manage tags
        </MorphingDialogTitle>
      </MorphingDialogTrigger>
      <MorphingDialogContainer>
        <MorphingDialogContent className="w-80 rounded-3xl border border-border bg-surface p-4 shadow-xl">
          <div ref={dialogContentRef} onMouseDown={handleDialogMouseDown}>
            <MorphingDialogTitle
              key={"manage_tag"}
              className="mb-3 text-sm font-medium text-foreground"
            >
              Manage Tags
            </MorphingDialogTitle>

            <Separator className="mb-3" />

            {/* Create tag section */}
            <Label className="mb-2 block text-[11px] font-medium text-muted-foreground">
              New tag
            </Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                  placeholder="Tag name..."
                  className="h-8 w-full rounded-full border border-border bg-background px-3 pr-8 text-xs text-foreground placeholder:text-muted-foreground/50 shadow-none"
                />
                {newName && (
                  <Button
                    isIconOnly
                    variant="tertiary"
                    size="sm"
                    onPress={() => setNewName("")}
                    className="absolute right-1 top-1/2 -translate-y-1/2 size-6 min-w-0"
                  >
                    <X className="size-3" strokeWidth={3} />
                  </Button>
                )}
              </div>
              <ColorPicker
                value={newColor}
                onChange={(color) => {
                  const nextColor = colorToHslString(color);
                  if (nextColor) setNewColor(nextColor);
                }}
              >
                <ColorPicker.Trigger
                  ref={colorTriggerRef}
                  onPress={overlayOpen}
                  className="group"
                >
                  <ColorSwatch
                    className="size-8 shrink-0 rounded-full border border-border shadow-sm transition-shadow group-hover:shadow-md"
                    size="lg"
                  />
                </ColorPicker.Trigger>
                <ColorPicker.Popover
                  placement="left top"
                  className="z-50"
                  onOpenChange={(isOpen) =>
                    isOpen ? overlayOpen() : overlayClose()
                  }
                >
                  <ColorArea
                    aria-label="Color area"
                    className="max-w-full"
                    colorSpace="hsb"
                    xChannel="saturation"
                    yChannel="brightness"
                  >
                    <ColorArea.Thumb />
                  </ColorArea>
                  <ColorSlider
                    channel="hue"
                    className="gap-1 px-1"
                    colorSpace="hsb"
                  >
                    <Label>Hue</Label>
                    <ColorSlider.Output className="text-muted" />
                    <ColorSlider.Track>
                      <ColorSlider.Thumb />
                    </ColorSlider.Track>
                  </ColorSlider>
                  <ColorSelectButton
                    triggerRef={colorTriggerRef}
                    onClose={overlayClose}
                  />
                </ColorPicker.Popover>
              </ColorPicker>
            </div>
            <Button
              variant="primary"
              size="md"
              isDisabled={!newName.trim()}
              onPress={handleCreate}
              className="mt-2 w-full transition-all disabled:opacity-40 disabled:grayscale"
            >
              <Plus className="size-4" />
              Create tag
            </Button>

            <Separator className="my-4" />

            {/* Tags list */}
            <Label className="mb-2 block text-[11px] font-medium text-muted-foreground">
              Your tags
            </Label>
            <ScrollShadow className="max-h-52 space-y-0.5" size={20}>
              {tags.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-6 text-muted-foreground">
                  <Tag className="size-5 opacity-40" />
                  <p className="text-xs">No tags yet</p>
                </div>
              ) : (
                tags.map((tag) => (
                  <TagItem
                    key={tag._id}
                    tag={tag}
                    isEditing={editingId === tag._id}
                    editName={editName}
                    onEditNameChange={setEditName}
                    onStartEdit={() => handleStartEdit(tag)}
                    onSaveEdit={() => handleSaveEdit(tag._id)}
                    onCancelEdit={() => setEditingId(null)}
                    onDelete={() => onDeleteTag(tag._id)}
                    onChangeColor={onChangeColor}
                  />
                ))
              )}
            </ScrollShadow>

            <Separator className="my-3" />
            <DialogCloseButton />
          </div>
        </MorphingDialogContent>
      </MorphingDialogContainer>
    </MorphingDialog>
  );
}

function DialogCloseButton() {
  const { setIsOpen } = useMorphingDialog();
  return (
    <Button
      variant="tertiary"
      size="sm"
      className="w-full"
      onPress={() => setIsOpen(false)}
    >
      Done
    </Button>
  );
}

function TagItem({
  tag,
  isEditing,
  editName,
  onEditNameChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onChangeColor,
}: {
  tag: Doc<"tags">;
  isEditing: boolean;
  editName: string;
  onEditNameChange: (value: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onChangeColor: (id: string, color: string) => Promise<void>;
}) {
  const [hovered, setHovered] = useState(false);
  const [deleteHovered, setDeleteHovered] = useState(false);
  const penRef = useRef<AnimatedIconHandle>(null);
  const colorTriggerRef = useRef<HTMLButtonElement>(null);
  const { open: overlayOpen, close: overlayClose } = useOverlayContext();

  useEffect(() => {
    if (hovered) {
      penRef.current?.startAnimation();
    } else {
      penRef.current?.stopAnimation();
    }
  }, [hovered]);

  return (
    <div
      className="group relative flex items-center gap-2 rounded-full px-3 py-2.5 overflow-hidden cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setDeleteHovered(false);
      }}
    >
      {!isEditing && (
        <>
          <motion.div
            className="absolute inset-0 bg-default"
            initial={false}
            animate={{ opacity: hovered && !deleteHovered ? 1 : 0 }}
            transition={{ duration: 0.15 }}
          />
          <motion.div
            className="absolute inset-0 bg-danger/10"
            initial={false}
            animate={{ scaleX: deleteHovered ? 1 : 0 }}
            style={{ transformOrigin: "right center" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          />
        </>
      )}
      <ColorPicker
        value={getSliderColor(tag.color)}
        onChange={(color) => {
          const nextColor = colorToHslString(color);
          if (nextColor) void onChangeColor(tag._id, nextColor);
        }}
      >
        <ColorPicker.Trigger ref={colorTriggerRef}>
          <ColorSwatch
            className="relative size-3.5 shrink-0 rounded-full cursor-pointer"
            aria-label={`${tag.name} color`}
            style={{ backgroundColor: getTagColor(tag.color) }}
          />
        </ColorPicker.Trigger>
        <ColorPicker.Popover
          placement="left top"
          className="z-50"
          onOpenChange={(isOpen) => (isOpen ? overlayOpen() : overlayClose())}
        >
          <ColorArea
            aria-label="Color area"
            className="max-w-full"
            colorSpace="hsb"
            xChannel="saturation"
            yChannel="brightness"
          >
            <ColorArea.Thumb />
          </ColorArea>
          <ColorSlider channel="hue" className="gap-1 px-1" colorSpace="hsb">
            <Label>Hue</Label>
            <ColorSlider.Output className="text-muted" />
            <ColorSlider.Track>
              <ColorSlider.Thumb />
            </ColorSlider.Track>
          </ColorSlider>
          <ColorSelectButton
            triggerRef={colorTriggerRef}
            onClose={overlayClose}
          />
        </ColorPicker.Popover>
      </ColorPicker>

      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="edit"
            className="flex flex-1 items-center"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.15 }}
          >
            <Input
              value={editName}
              onChange={(e) => onEditNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveEdit();
                if (e.key === "Escape") onCancelEdit();
              }}
              onBlur={onSaveEdit}
              autoFocus
              className="h-7 flex-1 rounded-full border border-border bg-background px-2.5 text-sm shadow-none"
            />
          </motion.div>
        ) : (
          <motion.button
            key="label"
            onClick={onStartEdit}
            className="relative flex flex-1 items-center gap-2 rounded h-7 text-left text-sm text-foreground cursor-pointer"
            initial={{ opacity: 0, x: 4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 4 }}
            transition={{ duration: 0.15 }}
          >
            <span className="flex-1">{tag.name}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {!isEditing && (
        <div
          className="relative size-6 shrink-0"
          onMouseEnter={() => setDeleteHovered(true)}
          onMouseLeave={() => setDeleteHovered(false)}
        >
          <motion.button
            className="absolute inset-0 flex items-center justify-center rounded text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onStartEdit();
            }}
            aria-label={`Edit ${tag.name}`}
            initial={false}
            animate={{
              scale: hovered && !deleteHovered ? 1 : 0,
              opacity: hovered && !deleteHovered ? 1 : 0,
            }}
            transition={{
              duration: 0.15,
              ease: "easeInOut",
              delay: hovered ? 0.08 : 0,
            }}
          >
            <PenIcon ref={penRef} size={16} strokeWidth={3} />
          </motion.button>
          <motion.button
            className="absolute inset-0 flex items-center justify-center text-danger overflow-hidden cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label={`Delete ${tag.name}`}
            initial={false}
            animate={{
              scale: hovered && deleteHovered ? 1 : 0,
              opacity: hovered && deleteHovered ? 1 : 0,
            }}
            transition={{
              duration: 0.15,
              ease: "easeInOut",
              delay: hovered ? 0.08 : 0,
            }}
          >
            <Trash2 className="size-4" strokeWidth={3} />
          </motion.button>
        </div>
      )}
    </div>
  );
}
