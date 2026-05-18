#!/usr/bin/env bash
# Thin wrapper — delegates to agent-ops-tool.py status.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$script_dir/agent-ops-tool.py" status
