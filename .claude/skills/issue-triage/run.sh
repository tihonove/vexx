#!/usr/bin/env bash
# Pool-runner for the issue-triage skill.
#
# Consumes *.prompt.md files from $RUN_DIR/queue and runs up to $CONCURRENCY headless
# `claude` workers at a time. Each worker gets its own git worktree (branch agents/<slug>)
# and its own tmux window. When a worker's process exits it drops a sentinel file; the
# loop reaps sentinels and launches the next queued item into the freed slot.
#
# Headless (`claude -p`) is deliberate: a worker never blocks on an interactive question,
# so it always terminates -> the slot always frees. The tmux window stays open
# (remain-on-exit on) and a full log is written per worker, so you can still walk up and read.
#
# Usage:
#   RUN_DIR=/path/to/run [CONCURRENCY=5] [POLL=20] [BASE_BRANCH=main] bash run.sh
#
# Queue file naming: NN-<slug>.prompt.md  (NN = order, <slug> = worktree/branch slug)

# Note: no `set -u` — iterating an empty associative array (RUNNING) trips it on bash 4.3.
set -o pipefail

CONCURRENCY="${CONCURRENCY:-5}"
POLL="${POLL:-20}"
BASE_BRANCH="${BASE_BRANCH:-main}"
TMUX_SESSION="${TMUX_SESSION:-vexx-agents}"

REPO_ROOT="$(git rev-parse --show-toplevel)"
REPO_NAME="$(basename "$REPO_ROOT")"
WT_BASE="$(dirname "$REPO_ROOT")/${REPO_NAME}.worktrees"

: "${RUN_DIR:?set RUN_DIR to the run directory containing queue/}"
QUEUE_DIR="$RUN_DIR/queue"
SENT_DIR="$RUN_DIR/sentinels"
LOG_DIR="$RUN_DIR/logs"
mkdir -p "$SENT_DIR" "$LOG_DIR"

# A detached tmux session hosts all worker windows.
tmux has-session -t "$TMUX_SESSION" 2>/dev/null || tmux new-session -d -s "$TMUX_SESSION" -n pool

slug_of() { basename "$1" .prompt.md | sed 's/^[0-9]*-//'; }

launch() {
  local prompt_file="$1"
  local slug branch wt log sentinel abs_prompt runner
  slug="$(slug_of "$prompt_file")"
  branch="agents/$slug"
  wt="$WT_BASE/agents-$slug"
  log="$LOG_DIR/$slug.log"
  sentinel="$SENT_DIR/$slug.done"
  abs_prompt="$(cd "$(dirname "$prompt_file")" && pwd)/$(basename "$prompt_file")"

  # Create the worktree (reuse if it already exists).
  if [ ! -d "$wt" ]; then
    git -C "$REPO_ROOT" worktree add "$wt" -b "$branch" "$BASE_BRANCH" >>"$log" 2>&1 \
      || git -C "$REPO_ROOT" worktree add "$wt" "$branch" >>"$log" 2>&1
  fi

  # Per-worker launcher avoids tmux quoting hell.
  runner="$RUN_DIR/run-$slug.sh"
  cat > "$runner" <<EOF
#!/usr/bin/env bash
cd '$wt' || { echo "no worktree" > '$sentinel'; exit 1; }
claude -p --dangerously-skip-permissions "\$(cat '$abs_prompt')" 2>&1 | tee -a '$log'
echo \${PIPESTATUS[0]} > '$sentinel'
EOF
  chmod +x "$runner"

  tmux new-window -t "$TMUX_SESSION" -n "$slug" "bash '$runner'"
  tmux set-window-option -t "$TMUX_SESSION:$slug" remain-on-exit on >/dev/null 2>&1 || true
  echo "launched: $slug (branch $branch, worktree $wt)"
}

mapfile -t QUEUE < <(ls "$QUEUE_DIR"/*.prompt.md 2>/dev/null | sort)
total=${#QUEUE[@]}
echo "queue: $total work items, concurrency $CONCURRENCY, run dir $RUN_DIR"
[ "$total" -eq 0 ] && { echo "empty queue, nothing to do"; exit 0; }

idx=0
declare -A RUNNING   # slug -> 1

while :; do
  # Reap finished workers.
  for slug in "${!RUNNING[@]}"; do
    if [ -f "$SENT_DIR/$slug.done" ]; then
      echo "done: $slug (exit $(cat "$SENT_DIR/$slug.done"))"
      unset 'RUNNING[$slug]'
    fi
  done

  # Fill free slots from the queue.
  while [ "${#RUNNING[@]}" -lt "$CONCURRENCY" ] && [ "$idx" -lt "$total" ]; do
    pf="${QUEUE[$idx]}"; idx=$((idx + 1))
    slug="$(slug_of "$pf")"
    if [ -f "$SENT_DIR/$slug.done" ]; then echo "skip (already done): $slug"; continue; fi
    launch "$pf"
    RUNNING["$slug"]=1
  done

  # All queued and nothing running -> finished.
  if [ "$idx" -ge "$total" ] && [ "${#RUNNING[@]}" -eq 0 ]; then break; fi
  sleep "$POLL"
done

echo "=== all work items finished ==="
for s in "$SENT_DIR"/*.done; do
  [ -e "$s" ] || continue
  echo "  $(basename "$s" .done): exit $(cat "$s")"
done
