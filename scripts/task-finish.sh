#!/usr/bin/env bash
# Thin wrapper — delegates to agent-ops-tool.py finish.
# Backward-compatible with old positional interface.
set -euo pipefail

result="${1:-done}"
case "$result" in
  done|parked|killed) ;;
  *)
    echo "usage: $0 [done|parked|killed]" >&2
    exit 2
    ;;
esac

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$script_dir/agent-ops-tool.py" finish "$result"
