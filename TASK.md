# Active Task

Status: none
Owner: none
Started: none
Task file: none

## Current Objective

No active task.

## Rules

- Start exactly one task before implementation:

  ```bash
  ./scripts/task-start.sh "task title" Codex
  ```

- Keep the owner responsible for edits, verification, and final summary.
- Advisors can comment, review, or research, but they do not edit the active
  concern unless ownership is transferred in this file.
- Finish or park the active task before starting another:

  ```bash
  ./scripts/task-finish.sh done
  ./scripts/task-finish.sh parked
  ```
