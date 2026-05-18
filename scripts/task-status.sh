#!/usr/bin/env bash
set -euo pipefail

state_file=".ai/state/active-task.json"

if [[ ! -f "$state_file" ]]; then
  echo "no active task"
  exit 0
fi

python3 - <<'PY'
import json
from datetime import datetime, timezone
from pathlib import Path

state = json.loads(Path(".ai/state/active-task.json").read_text())
started = datetime.fromisoformat(state["started_at"])
age = datetime.now(timezone.utc) - started

print(f"status: {state.get('status')}")
print(f"owner: {state.get('owner')}")
print(f"title: {state.get('title')}")
print(f"task_file: {state.get('task_file')}")
print(f"age_hours: {age.total_seconds() / 3600:.1f}")

if state.get("status") == "active" and age.total_seconds() > 48 * 3600:
    print("warning: active task is older than 48 hours")
PY

