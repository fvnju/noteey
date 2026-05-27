"use client";

import {
  FormattingToolbar as BlockNoteFormattingToolbar,
  type FormattingToolbarProps,
  getFormattingToolbarItems,
} from "@blocknote/react";
import { AIToolbarButton } from "@blocknote/xl-ai";

export function FormattingToolbar(props: FormattingToolbarProps) {
  return (
    <BlockNoteFormattingToolbar {...props}>
      {getFormattingToolbarItems(props.blockTypeSelectItems)}
      <AIToolbarButton />
    </BlockNoteFormattingToolbar>
  );
}
