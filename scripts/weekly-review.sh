#!/usr/bin/env bash
set -euo pipefail

review_dir=".ai/reviews"
mkdir -p "$review_dir"
date_stamp="$(date +%Y-%m-%d)"
review_file="$review_dir/$date_stamp.md"

if [[ -f "$review_file" ]]; then
  echo "$review_file already exists"
  exit 0
fi

cat > "$review_file" <<EOF
# Weekly Review - $date_stamp

## Shipped

- 

## Repeated Pain

- 

## Experiments

| Experiment | Continue/Park/Kill | Evidence |
| --- | --- | --- |
|  |  |  |

## Project Scores

| Project | Score / 35 | Decision | Next Action |
| --- | ---: | --- | --- |
|  |  |  |  |

## Decisions To Record

- 

## Next Week Focus

One bet:

One workflow to improve:

One thing to ignore:
EOF

echo "created $review_file"

