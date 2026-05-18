#!/usr/bin/env bash
# Thin wrapper — delegates to agent-ops-tool.py start.
# Backward-compatible with old positional interface.
set -euo pipefail

title="${1:-}"
owner="${2:-Codex}"

if [[ -z "$title" ]]; then
  echo "usage: $0 \"task title\" [owner]" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$script_dir/agent-ops-tool.py" start "$title" --owner "$owner"
