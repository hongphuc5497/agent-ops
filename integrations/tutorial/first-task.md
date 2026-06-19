# Agent Ops Tutorial — your first task

Status: active
Owner: you
Started: pending
Workflow: walkthrough
Verification: complete every step below

## Objective

Learn the Agent Ops coordination loop in five minutes. This task is the active
task right now — every Agent Ops command you run will operate on it.

## What you'll do

You'll exercise the four commands that make up the coordination loop:

1. **claim** — reserve files before editing so another agent can't race you
2. **delegate** — hand a sub-task to a different agent with explicit acceptance
3. **status** — see who owns what, anytime
4. **finish** — close the task with verification evidence

Nothing below modifies your real code. The paths are fake; you're just driving
the protocol.

## Steps

### 1. See where you are

```bash
agent-ops status
```

You should see this tutorial task as the active task, owned by `you`, with no
file claims yet.

### 2. Claim a file

```bash
agent-ops claim "src/example.ts"
```

The CLI records that `you` own edits to `src/example.ts` for the duration of
this task. Any other agent (Codex, Claude, OpenCode, …) that tries to claim
the same path will be rejected until you finish or hand off.

Run `agent-ops status` again — you'll see the claim listed.

### 3. Delegate a sub-task

```bash
agent-ops delegate "review the change" --to OpenClaw --acceptance "approved or rejected with reason"
```

A handoff event is appended to `.ai/state/handoffs.jsonl`. Open that file —
you'll see the full audit trail of who handed what to whom.

### 4. Finish the tutorial

```bash
agent-ops finish done --verification "completed the Agent Ops tutorial"
```

The active task closes, claims are released, and the task is archived to
`.ai/tasks/archive/`. `TASK.md` resets to "no active task."

## What you learned

- Exactly one agent owns the active task at a time.
- Claims prevent two agents editing the same file.
- Handoffs are auditable in `.ai/state/handoffs.jsonl`.
- Every task closes with a verification string — no silent "done."

## Next

```bash
agent-ops install codex      # if you use Codex
agent-ops install claude     # if you use Claude Code
agent-ops kanban             # open the local task board
agent-ops doctor             # diagnostic if anything looks off
```

For the full protocol, read `.ai/protocol.md` and `ROUTING.md`.

## Result

Changed files:

- (none — this was a walkthrough)

Verification:

- you ran each command above and saw the expected state transitions

Risks:

- none — tutorial tasks are isolated from real work
