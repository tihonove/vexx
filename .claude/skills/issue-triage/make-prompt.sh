#!/usr/bin/env bash
# Render a worker prompt for one work item (one issue, or a group of related issues)
# by filling worker-prompt.template.md with issue data fetched via `gh`.
#
# Usage:
#   RUN_DIR=/path/to/run bash make-prompt.sh <NN> <slug> <issue> [more-issues...]
#
# Writes $RUN_DIR/queue/<NN>-<slug>.prompt.md . The first issue is the "primary"
# (used for TITLE and as the analysis-comment target); extra issues are appended.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export TEMPLATE="$SCRIPT_DIR/worker-prompt.template.md"

: "${RUN_DIR:?set RUN_DIR}"
NN="${1:?order NN}"; SLUG="${2:?slug}"; shift 2
PRIMARY="${1:?at least one issue number}"

QUEUE_DIR="$RUN_DIR/queue"; mkdir -p "$QUEUE_DIR"
export OUT="$QUEUE_DIR/${NN}-${SLUG}.prompt.md"

refs=""; body=""; primary_title=""
for n in "$@"; do
  t="$(gh issue view "$n" --json title --jq '.title')"
  b="$(gh issue view "$n" --json body --jq '.body')"
  [ -n "$refs" ] && refs="$refs, "
  refs="$refs#$n"
  [ "$n" = "$PRIMARY" ] && primary_title="$t"
  [ -z "$b" ] && b="（тело пустое — ориентируйся на заголовок и на поведение VS Code）"
  body+=$'\n\n### Issue #'"$n"': '"$t"$'\n\n'"$b"
done

# Pass everything through the environment so arbitrary issue text can't break parsing.
export V_BRANCH="agents/$SLUG"
export V_REFS="$refs"
export V_TITLE="$primary_title"
export V_NUMBER="$PRIMARY"
export V_BODY="$body"

python3 - <<'PY'
import os
repl = {
    "{{BRANCH}}":       os.environ["V_BRANCH"],
    "{{ISSUE_REFS}}":   os.environ["V_REFS"],
    "{{TITLE}}":        os.environ["V_TITLE"],
    "{{ISSUE_NUMBER}}": os.environ["V_NUMBER"],
    "{{BODY}}":         os.environ["V_BODY"],
}
s = open(os.environ["TEMPLATE"], encoding="utf-8").read()
for k, v in repl.items():
    s = s.replace(k, v)
open(os.environ["OUT"], "w", encoding="utf-8").write(s)
print("wrote", os.environ["OUT"])
PY
