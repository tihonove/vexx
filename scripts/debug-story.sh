#!/usr/bin/env bash
set -e

CMD="npx tsx --inspect-brk=9229 src/StoryRunner/run.ts $@"

if [[ -n "$SSH_CONNECTION" || -n "$REMOTE_CONTAINERS" || -n "$CODESPACES" ]]; then
    exec bash -c "$CMD"
else
    exec gnome-terminal --working-directory="$(pwd)" -- bash -c "$CMD; exec bash"
fi
