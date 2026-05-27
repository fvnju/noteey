# Noteey

Noteey is a collaborative note-taking space where people write, share, and organize notes.

## Language

**Inline AI Editing**:
AI assistance that operates directly inside a **Note** at the user’s current selection, cursor, or nearby blocks. It helps reshape note content through focused writing actions such as improving, shortening, lengthening, summarizing, fixing grammar, or continuing text without becoming a separate chat workspace.
_Avoid_: AI features, AI assistant, smart editor

**Note**:
A user-authored writing space containing a title, body content, collaborators, and user-specific organization metadata such as tags.
_Avoid_: Document, page

**AI Context**:
The portion of a **Note** made available to Inline AI Editing for one request. By default, it is the selected blocks or cursor neighborhood plus the note title; the whole Note is included only for explicitly whole-note actions.
_Avoid_: Prompt context, document context

**Owner**:
The person who created a **Note** and has full control over it.
_Avoid_: Admin

**Editor**:
A collaborator who may change a shared **Note**. An Editor may use Inline AI Editing, but AI output is not part of the Note until that Editor inserts it.
_Avoid_: Collaborator, writer

**AI Suggestion**:
A proposed change produced by Inline AI Editing that the user can accept or discard. An AI Suggestion becomes part of the **Note** only after explicit acceptance.
_Avoid_: AI edit, generated answer

## Example dialogue

Dev: “Should the AI open in a separate assistant panel?”
Domain expert: “No. For the first version, keep it as Inline AI Editing inside the Note so the user stays in the writing flow.”

Dev: “Can Inline AI Editing rewrite selected text?”
Domain expert: “Yes. It should act on the selected part of the Note or continue from the cursor, not answer broad questions across all notes.”
