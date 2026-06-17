# Agent Ops Kanban Feature Spec

## Goal

Add `agent-ops kanban`, a local browser UI for the current repo that shows all
Agent Ops tasks on a kanban board and lets users create or update tasks without
leaving the UI.

## Product Read

This is a local developer workbench, not a hosted dashboard. It should help one
repo owner see task state, claims, handoffs, and verification quickly. It must
preserve Agent Ops rules: one active task, explicit file claims, command-backed
writes, and verification evidence before completion.

## Recommended Approach

Build a dependency-free local web server inside the existing Node package.

Alternatives considered:

1. **Static HTML export only.** Lowest risk, but cannot create or update tasks.
2. **Terminal TUI.** Fits the shell, but makes forms, filters, task editing, and
   future browser screenshots harder.
3. **Local browser UI with small HTTP API.** Best fit for the approved mockup
   and create/update requirement. It keeps writes local and auditable.

Recommendation: option 3.

## User Workflows

### Open the board

```bash
agent-ops kanban
```

The command starts a local server bound to `127.0.0.1`, prints the URL, and opens
the browser when possible. It reads state from the current working repo.

### Create a task

The user clicks `New task`, fills title, owner, workflow, verification, optional
files in scope, and status.

Supported v1 statuses:

- `backlog`: creates a task markdown record only.
- `active`: runs the same lock semantics as `agent-ops start`.

If an active task already exists, creating another active task fails with a clear
inline error.

### Update a task

The user opens a task in the right drawer and can update:

- title
- owner
- workflow
- verification text
- files in scope
- out of scope

For active tasks, updates must synchronize `.ai/state/active-task.json`,
`TASK.md`, and the matching `.ai/tasks/*.md` record.

### Claim files

The user adds file paths in the drawer. The UI calls the existing claim command
and shows conflicts inline.

### Finish, park, or kill

The user chooses a result, enters verification when relevant, and confirms.
The UI calls the existing finish command. The task moves to `Done`, `Parked`, or
`Killed` based on archived status.

## Data Model

The UI reads these existing files:

- `TASK.md`
- `.ai/state/active-task.json`
- `.ai/state/file-claims.json`
- `.ai/state/handoffs.jsonl`
- `.ai/tasks/*.md`
- `.ai/tasks/archive/*.json`

New command-backed JSON shape for the UI:

```json
{
  "ok": true,
  "repo": "/path/to/repo",
  "active": true,
  "columns": {
    "backlog": [],
    "active": [],
    "parked": [],
    "done": [],
    "killed": []
  },
  "claims": [],
  "handoffs": [],
  "health": {
    "stale": false,
    "missing": [],
    "invalid_json": [],
    "invalid_jsonl": []
  }
}
```

Task card shape:

```json
{
  "id": "20260617-120000-example",
  "title": "example task",
  "status": "backlog",
  "owner": "Codex",
  "workflow": ".ai/workflows/feature.md",
  "verification": "npm test",
  "task_file": ".ai/tasks/20260617-120000-example.md",
  "created_at": "2026-06-17T12:00:00+00:00",
  "finished_at": null,
  "files_in_scope": [],
  "out_of_scope": []
}
```

## Command API

Add these commands to `scripts/agent-ops-tool.py`:

- `kanban-snapshot`: read all board data and print JSON.
- `create-task`: create backlog task records or active tasks.
- `update-task`: update editable task fields through one audited command.

Keep existing commands for:

- `claim`
- `delegate`
- `finish`
- `check`

Add these commands to `bin/agent-ops.js`:

- `kanban`: start the local server.

## UI Architecture

Create a small dependency-free web app:

```text
bin/agent-ops.js
  -> agent-ops kanban
  -> bin/kanban-server.js
     -> GET /api/snapshot
     -> POST /api/tasks
     -> PATCH /api/tasks/:id
     -> POST /api/tasks/:id/claim
     -> POST /api/tasks/:id/finish
     -> POST /api/check
     -> static files from web/kanban/
```

The server should:

- bind to `127.0.0.1`
- pick an available port, defaulting to `4783`
- execute repo-local `scripts/agent-ops-tool.py`
- return JSON errors with command, exit code, stdout, and stderr excerpts
- never expose a remote host by default

## UI Requirements

Use the design system in `docs/kanban/DESIGN.md`.

Required screens and states:

- board with backlog, active, parked, done columns
- right drawer for creating and editing tasks
- empty board state
- inline write error state
- loading skeleton state
- mobile single-column layout

V1 exclusions:

- drag-and-drop persistence
- multi-user collaboration
- remote network access
- authentication
- database storage
- automatic background refresh beyond a manual `Refresh` button

## Safety Rules

- Browser writes must call command-backed APIs.
- Creating a second active task must fail.
- Updating active task must preserve one active owner.
- Finish requires verification text unless result is `killed`.
- API must reject path traversal in task ids.
- Server binds only to localhost.

## Verification

Required checks:

```bash
npm test
node tests/kanban-data.test.js
node tests/kanban-server.test.js
bash -n scripts/*.sh
python3 -m py_compile scripts/agent-ops-tool.py
./scripts/agent-ops-check.sh
npm pack --dry-run
```

Manual browser verification:

1. Run `agent-ops kanban --no-open`.
2. Open the printed local URL.
3. Confirm board loads from current repo state.
4. Create a backlog task.
5. Create an active task only when no active task exists.
6. Claim a file and see it appear.
7. Finish a task and see it move to Done.
8. Trigger a duplicate active task error and confirm it is inline.
