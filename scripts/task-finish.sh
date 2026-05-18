#!/usr/bin/env bash
set -euo pipefail

result="${1:-done}"
case "$result" in
  done|parked|killed) ;;
  *)
    echo "usage: $0 [done|parked|killed]" >&2
    exit 2
    ;;
esac

state_file=".ai/state/active-task.json"
archive_dir=".ai/tasks/archive"
mkdir -p "$archive_dir"

if [[ ! -f "$state_file" ]]; then
  echo "no active task"
  exit 0
fi

python3 - "$result" <<'PY'
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

result = sys.argv[1]
state_path = Path(".ai/state/active-task.json")
state = json.loads(state_path.read_text())
state["status"] = result
state["finished_at"] = datetime.now(timezone.utc).isoformat()

archive_path = Path(".ai/tasks/archive") / f"{state['id']}.json"
archive_path.write_text(json.dumps(state, indent=2) + "\n")
state_path.unlink()

Path("TASK.md").write_text("""# Active Task

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
""")

print(f"finished {state['id']} as {result}")
print(f"archived: {archive_path}")
PY

