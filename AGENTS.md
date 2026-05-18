# Agent Ops Instructions

This repo is the operating system for AI workflow orchestration. Keep it boring,
readable, and runnable by one indie developer.

## Defaults

- Prefer markdown files and tiny scripts over services, databases, or custom UI.
- Keep one active task owner in `TASK.md` and `.ai/state/active-task.json`.
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
  ./scripts/task-status.sh
  ```

- For workflow changes, dry-run the relevant script or checklist and update the
  workflow file with the result.

