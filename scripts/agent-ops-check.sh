#!/usr/bin/env bash
set -euo pipefail

required_files=(
  "AGENTS.md"
  "README.md"
  "TASK.md"
  "ROUTING.md"
  "DECISIONS.md"
  ".ai/ARCHITECTURE.md"
  ".ai/workflows/daily.md"
  ".ai/workflows/feature.md"
  ".ai/workflows/debugging.md"
  ".ai/workflows/ci-failure.md"
  ".ai/workflows/review.md"
  ".ai/workflows/experimentation.md"
  ".ai/templates/project-score.md"
)

missing=0
for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "missing required file: $file" >&2
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

if [[ -f ".ai/state/active-task.json" ]]; then
  python3 - <<'PY'
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

state = json.loads(Path(".ai/state/active-task.json").read_text())
if state.get("status") != "active":
    raise SystemExit(0)

started = datetime.fromisoformat(state["started_at"])
age_hours = (datetime.now(timezone.utc) - started).total_seconds() / 3600
if age_hours > 48:
    print(f"active task is stale: {age_hours:.1f} hours", file=sys.stderr)
    raise SystemExit(1)
PY
fi

bash -n scripts/*.sh
echo "agent-ops check passed"

