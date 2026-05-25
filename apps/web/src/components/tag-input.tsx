"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { measureNaturalWidth, prepareWithSegments } from "@chenglou/pretext";
import {
  ComboBox,
  EmptyState,
  Input,
  Label,
  ListBox,
  type Key,
} from "@heroui/react";
import { Plus } from "lucide-react";
import type { Doc, Id } from "@noteey/backend/convex/_generated/dataModel";
import { TagPill } from "@/components/tag-pill";

type TagInputProps = {
  tags: Doc<"tags">[];
  selectedTagIds: Id<"tags">[];
  onAddTag: (tagId: Id<"tags">) => void;
  onRemoveTag: (tagId: Id<"tags">) => void;
  onCreateTag: (name: string) => Promise<Id<"tags"> | undefined>;
};

const LEGACY_COLOR_CSS: Record<string, string> = {
  accent: "var(--color-accent)",
  default: "var(--color-default)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
};

const getTagColor = (color: string) => LEGACY_COLOR_CSS[color] ?? color;

const TAG_FONT = "13px sans-serif";
const TAG_HORIZONTAL_CHROME = 24;
const TAG_MAX_TEXT_WIDTH = 144;
const MORE_HORIZONTAL_CHROME = 24;
const INPUT_WIDTH = 112;
const ITEM_GAP = 6;
const ACTIVE_CLOSE_RESERVE_WIDTH = 26;

const measureTextWidth = (text: string, font: string) =>
  measureNaturalWidth(prepareWithSegments(text, font));

const getTagWidth = (name: string) =>
  Math.min(measureTextWidth(name, TAG_FONT), TAG_MAX_TEXT_WIDTH) +
  TAG_HORIZONTAL_CHROME;

const getVisibleTagCount = (tagNames: string[], availableWidth: number) => {
  if (tagNames.length === 0) return 0;

  const reservedInputWidth = INPUT_WIDTH + ITEM_GAP;
  const tagWidths = tagNames.map(getTagWidth);

  for (let visibleCount = tagNames.length; visibleCount >= 0; visibleCount--) {
    const hiddenCount = tagNames.length - visibleCount;
    const visibleWidth = tagWidths
      .slice(0, visibleCount)
      .reduce((sum, width) => sum + width, 0);
    const visibleItems = visibleCount + (hiddenCount > 0 ? 1 : 0) + 1;
    const gapsWidth = Math.max(0, visibleItems - 1) * ITEM_GAP;
    const moreWidth =
      hiddenCount > 0
        ? measureTextWidth(`+${hiddenCount} more`, TAG_FONT) + MORE_HORIZONTAL_CHROME
        : 0;

    if (
      visibleWidth +
        moreWidth +
        reservedInputWidth +
        gapsWidth +
        ACTIVE_CLOSE_RESERVE_WIDTH <=
      availableWidth
    ) {
      return visibleCount;
    }
  }

  return 0;
};

type TagInputState = {
  inputValue: string;
  selectedKey: Key | null;
  creating: boolean;
  containerWidth: number;
  activeCloseTagId: string | null;
};

type TagInputAction =
  | { type: "SET_INPUT"; value: string }
  | { type: "SELECT_KEY"; key: Key | null }
  | { type: "CLEAR_INPUT" }
  | { type: "CREATE_START" }
  | { type: "CREATE_END" }
  | { type: "RESIZE"; width: number }
  | { type: "HOVER_TAG"; tagId: string }
  | { type: "HOVER_END" };

const initialState: TagInputState = {
  inputValue: "",
  selectedKey: null,
  creating: false,
  containerWidth: 0,
  activeCloseTagId: null,
};

function tagInputReducer(
  state: TagInputState,
  action: TagInputAction,
): TagInputState {
  switch (action.type) {
    case "SET_INPUT":
      return { ...state, inputValue: action.value };
    case "SELECT_KEY":
      return { ...state, selectedKey: action.key };
    case "CLEAR_INPUT":
      return { ...state, inputValue: "", selectedKey: null };
    case "CREATE_START":
      return { ...state, creating: true };
    case "CREATE_END":
      return { ...state, creating: false };
    case "RESIZE":
      return { ...state, containerWidth: action.width };
    case "HOVER_TAG":
      return { ...state, activeCloseTagId: action.tagId };
    case "HOVER_END":
      return { ...state, activeCloseTagId: null };
  }
}

export function TagInput({
  tags,
  selectedTagIds,
  onAddTag,
  onRemoveTag,
  onCreateTag,
}: TagInputProps) {
  const [state, dispatch] = useReducer(tagInputReducer, initialState);
  const { inputValue, selectedKey, creating, containerWidth, activeCloseTagId } =
    state;
  const hideCloseTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedTags = tags.filter((t) => selectedTagIds.includes(t._id));
  const visibleTagCount = useMemo(
    () =>
      getVisibleTagCount(
        selectedTags.map((tag) => tag.name),
        containerWidth,
      ),
    [selectedTags, containerWidth],
  );
  const visibleTags = selectedTags.slice(0, visibleTagCount);
  const hiddenTagCount = Math.max(0, selectedTags.length - visibleTagCount);
  const availableTags = tags.filter((t) => !selectedTagIds.includes(t._id));
  const filteredTags = inputValue
    ? availableTags.filter((t) =>
        t.name.toLowerCase().includes(inputValue.toLowerCase()),
      )
    : availableTags;

  const exactMatch = tags.find(
    (t) => t.name.toLowerCase() === inputValue.toLowerCase(),
  );

  const handleSelect = useCallback(
    (tagId: Id<"tags">) => {
      onAddTag(tagId);
      dispatch({ type: "CLEAR_INPUT" });
    },
    [onAddTag],
  );

  const handleCreate = useCallback(async () => {
    if (!inputValue.trim() || creating) return;
    dispatch({ type: "CREATE_START" });
    const id = await onCreateTag(inputValue.trim());
    dispatch({ type: "CREATE_END" });
    if (id) {
      onAddTag(id);
      dispatch({ type: "CLEAR_INPUT" });
    }
  }, [inputValue, creating, onCreateTag, onAddTag]);

  const handleAutocompleteSelection = useCallback(
    (key: Key | null) => {
      dispatch({ type: "SELECT_KEY", key });
      if (key == null) return;

      if (key === "__create__") {
        void handleCreate();
        return;
      }

      handleSelect(key as Id<"tags">);
    },
    [handleCreate, handleSelect],
  );

  const handleCloseVisibilityStart = useCallback((tagId: string) => {
    if (hideCloseTimer.current) clearTimeout(hideCloseTimer.current);
    dispatch({ type: "HOVER_TAG", tagId });
  }, []);

  const handleCloseVisibilityEnd = useCallback(() => {
    if (hideCloseTimer.current) clearTimeout(hideCloseTimer.current);
    hideCloseTimer.current = setTimeout(() => {
      dispatch({ type: "HOVER_END" });
    }, 260);
  }, []);

  useEffect(() => {
    return () => {
      if (hideCloseTimer.current) clearTimeout(hideCloseTimer.current);
    };
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(([entry]) => {
      dispatch({ type: "RESIZE", width: entry.contentRect.width });
    });
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex h-8 min-h-8 flex-nowrap items-center gap-1.5 overflow-hidden">
        {visibleTags.map((tag) => (
          <TagPill
            key={tag._id}
            tag={tag}
            isCloseVisible={activeCloseTagId === tag._id}
            onCloseVisibilityStart={() => handleCloseVisibilityStart(tag._id)}
            onCloseVisibilityEnd={handleCloseVisibilityEnd}
            onRemoveAction={() => onRemoveTag(tag._id)}
          />
        ))}
        {hiddenTagCount > 0 && (
          <span className="inline-flex h-8 shrink-0 cursor-default items-center rounded-full bg-[#e1e1e1] px-3 text-[13px] font-normal leading-none text-[#2f2f2f] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:bg-[#e1e1e1] dark:text-[#2f2f2f]">
            +{hiddenTagCount} more
          </span>
        )}
        <ComboBox
          allowsCustomValue
          allowsEmptyCollection
          aria-label="Add tag"
          className="w-28 shrink-0"
          inputValue={inputValue}
          menuTrigger="focus"
          selectedKey={selectedKey}
          variant="secondary"
          onInputChange={(v) => dispatch({ type: "SET_INPUT", value: v })}
          onSelectionChange={handleAutocompleteSelection}
        >
          <ComboBox.InputGroup className="h-8 rounded-none border-0 bg-transparent p-0 shadow-none">
            <Input
              placeholder="Add tag..."
              className="h-8 bg-transparent px-0 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
              onKeyDown={(e) => {
                if (e.key === "Enter" && inputValue.trim() && !exactMatch) {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
            />
          </ComboBox.InputGroup>
          <ComboBox.Popover>
            <ListBox
              className="outline-none"
              renderEmptyState={() => (
                <EmptyState className="py-4 text-xs text-muted-foreground">
                  {inputValue.trim()
                    ? "Press Enter to create this tag"
                    : "Start typing to find tags"}
                </EmptyState>
              )}
            >
              {filteredTags.slice(0, 6).map((tag) => (
                <ListBox.Item
                  key={tag._id}
                  id={tag._id}
                  textValue={tag.name}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: getTagColor(tag.color) }}
                  />
                  <Label>{tag.name}</Label>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
              {inputValue.trim() && !exactMatch && (
                <ListBox.Item
                  id="__create__"
                  textValue={`Create ${inputValue.trim()}`}
                  isDisabled={creating}
                >
                  <Plus className="size-3.5" />
                  <Label>
                    Create “{inputValue.trim()}”
                  </Label>
                </ListBox.Item>
              )}
            </ListBox>
          </ComboBox.Popover>
        </ComboBox>
      </div>
    </div>
  );
}
