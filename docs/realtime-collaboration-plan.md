# Realtime collaboration plan

## Goal

Add a separately deployable Node.js realtime backend at `apps/realtime` for whole-note live collaboration in the notes app. Multiple authenticated users should edit a note simultaneously with cursor/presence support, offline editing, reconnect/resume, and durable recovery of unsaved edits.

## Architecture

```txt
apps/web
  BlockNote + Yjs
  HocuspocusProvider
  y-indexeddb offline cache
        |
        | authenticated WebSocket
        v
apps/realtime
  Hocuspocus collaboration server
  Hono-style health/API surface
  Convex HTTP client
        |
        v
packages/backend/convex
  notes metadata
  note collaborators
  durable Yjs update log
  user-created Yjs snapshot commits
```

## Storage model

Use a hybrid, git-like model:

- **Yjs incremental updates** are the working-tree/change-log data. They are appended to Convex on every Hocuspocus document change.
- **Snapshots** are user-created commits. A snapshot stores the encoded Yjs document state at a particular update sequence.
- **Current note JSON** remains on `notes.content` as a view/cache for existing UI and list flows. It is updated when the user explicitly commits.

Tables:

- `notes`: owner, title, current JSON content cache, tags, latest committed snapshot.
- `noteCollaborators`: explicit collaborators. Current policy is owner by default; collaborators are editors.
- `noteCollabStates`: one row per note tracking the latest Yjs update sequence.
- `noteYjsUpdates`: append-only durable update log.
- `noteSnapshots`: committed encoded Yjs states.

## Load/recovery flow

1. Client opens a note and creates a Yjs document.
2. Client attaches `y-indexeddb` immediately, so offline/local edits load first.
3. Client connects to `apps/realtime` using Hocuspocus with an Auth0/Convex-compatible token.
4. Realtime server authenticates and asks Convex whether the user can access `note:{noteId}`.
5. Hocuspocus loads the latest committed snapshot plus all later updates from Convex.
6. Yjs merges server state with the browser's local IndexedDB state.
7. Every incoming document update is appended to Convex before being considered durable by the server hook.

## Auth policy

- The note creator is the owner.
- A `noteCollaborators` row grants editor access.
- Realtime joins are rejected unless Convex confirms the authenticated user can access the note.

## Deployment

`apps/realtime` is a standalone Node/Bun service suitable for Railway, Render, or Heroku. Vercel should not be used for this persistent WebSocket service.

## Implementation phases

1. Add `apps/realtime` with Hocuspocus/Yjs and health endpoints.
2. Add Convex schema/functions for collaboration state, updates, snapshots, and access checks.
3. Wire authenticated Hocuspocus provider into the BlockNote editor.
4. Add IndexedDB offline support.
5. Add explicit commit/save snapshot UX.
6. Add future compaction/pruning after the MVP proves the data flow.

## Future hardening

- Add compaction that prunes updates older than the latest snapshot.
- Add Redis if the realtime service must scale horizontally.
- Add backpressure/batching if Convex-per-update becomes too chatty.
- Add viewer role/read-only mode.
- Add integration tests for auth, recovery, and snapshot reconstruction.
