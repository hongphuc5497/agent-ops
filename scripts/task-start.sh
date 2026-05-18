#!/usr/bin/env bash
set -euo pipefail

title="${1:-}"
owner="${2:-Codex}"

if [[ -z "$title" ]]; then
  echo "usage: $0 \"task title\" [owner]" >&2
  exit 2
fi

state_dir=".ai/state"
tasks_dir=".ai/tasks"
mkdir -p "$state_dir" "$tasks_dir" "$tasks_dir/archive"

if [[ -f "$state_dir/active-task.json" ]]; then
  active_status="$(python3 - <<'PY'
import json
from pathlib import Path
p = Path(".ai/state/active-task.json")
try:
    print(json.loads(p.read_text()).get("status", ""))
except Exception:
    print("unknown")
PY
)"
  if [[ "$active_status" == "active" ]]; then
    echo "active task already exists; run ./scripts/task-status.sh" >&2
    exit 1
  fi
fi

python3 - "$title" "$owner" <<'PY'
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

title, owner = sys.argv[1], sys.argv[2]
now = datetime.now(timezone.utc)
slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:60] or "task"
task_id = f"{now.strftime('%Y%m%d-%H%M%S')}-{slug}"
task_path = Path(".ai/tasks") / f"{task_id}.md"
state_path = Path(".ai/state/active-task.json")

state = {
    "id": task_id,
    "title": title,
    "owner": owner,
    "status": "active",
    "started_at": now.isoformat(),
    "task_file": str(task_path),
}
state_path.write_text(json.dumps(state, indent=2) + "\n")

task_path.write_text(f"""# {title}

Status: active
Owner: {owner}
Started: {now.isoformat()}

## Objective

## Acceptance Criteria

- 

## Files In Scope

- 

## Out Of Scope

- 

## Verification

```bash

```

## Result

Changed files:

Verification:

Risks:
""")

Path("TASK.md").write_text(f"""# Active Task

Status: active
Owner: {owner}
Started: {now.isoformat()}
Task file: {task_path}

## Current Objective

{title}

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

print(f"started {task_id}")
print(f"task file: {task_path}")
PY

