# Agent Ops Instructions

This repo is the operating system for AI workflow orchestration. Keep it boring,
readable, and runnable by one indie developer.

## Defaults

- Prefer markdown files and tiny scripts over services, databases, or custom UI.
- Keep one active task owner in `TASK.md` and `.ai/state/active-task.json`.
- Use `.ai/protocol.md` as the shared protocol for agent integrations.
- Use `scripts/agent-ops-tool.py` for JSON state when an agent needs a tool call.
- Do not let multiple agents edit the same concern at the same time.
- Capture decisions in `DECISIONS.md` before building machinery around them.
- Put speculative ideas in `.ai/parking-lot.md`, not in active workflow docs.

## Editing Rules

- Use `apply_patch` for manual edits.
- Keep files ASCII unless a file already uses non-ASCII.
- Add scripts only when they remove repeated manual work.
- Avoid dependencies unless the value is proven by repeated use.

## Verification

- For docs-only changes, run:

  ```bash
  bash -n scripts/*.sh
  python3 -m py_compile scripts/agent-ops-tool.py
  ./scripts/task-status.sh
  ```

- For workflow changes, dry-run the relevant script or checklist and update the
  workflow file with the result.

# Agent Ops Rules for Codex

When this repo contains `.ai/protocol.md`, use Agent Ops as the coordination
protocol.

Before editing:

1. Read `.ai/protocol.md`, `TASK.md`, and `ROUTING.md`.
2. Run `scripts/agent-ops-tool.py status` when available.
3. If no task is active and the user requested implementation, start one with
   `scripts/agent-ops-tool.py start`.
4. Claim files before editing with `scripts/agent-ops-tool.py claim`.

During work:

- Keep Codex as the active owner unless ownership is explicitly transferred.
- Use Augment for codebase discovery and impact mapping.
- Use OpenClaw for product/scope review only.
- Use OpenCode only for isolated file sets.
- Do not let two agents edit the same concern simultaneously.

Before finishing:

1. Run the task-specific verification.
2. Run `scripts/agent-ops-tool.py check`.
3. Finish with `scripts/agent-ops-tool.py finish done --verification "..."`
   or explicitly park/kill the task.

