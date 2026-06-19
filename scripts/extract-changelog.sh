#!/usr/bin/env bash
# Extract a single version's section from CHANGELOG.md.
#
# Usage: scripts/extract-changelog.sh 0.3.0
#
# Reads CHANGELOG.md from the repo root. Prints everything from the
# matching `## <version>` heading up to (but not including) the next
# `## ` heading. Exits 0 with empty output if no matching section is
# found — callers should treat that as a soft warning, not a hard fail.

set -euo pipefail

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "usage: $0 <version>" >&2
  exit 2
fi

CHANGELOG="${CHANGELOG_PATH:-CHANGELOG.md}"
if [[ ! -f "$CHANGELOG" ]]; then
  echo "$CHANGELOG not found" >&2
  exit 1
fi

# awk: when we see `## <VERSION>` start printing; stop at the next `## ` heading.
awk -v ver="$VERSION" '
  BEGIN { capture = 0 }
  /^## / {
    if (capture) { exit }
    # Match either "## 0.3.0" or "## 0.3.0 — title" — version must be a token.
    if ($2 == ver) {
      capture = 1
      next
    }
  }
  capture { print }
' "$CHANGELOG"
