#! /usr/bin/env bash

cd $(dirname "$0")
set -e

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <worktree-name>"
    exit 1
fi

WORKTREE_NAME="$1"
REPO_ROOT=$(git rev-parse --show-toplevel)
WORKTREE_DIR="$REPO_ROOT/.worktrees"
git worktree add -b "$WORKTREE_NAME" "$WORKTREE_DIR/$WORKTREE_NAME" main
cp "${REPO_ROOT}/backend/.env" "$WORKTREE_DIR/$WORKTREE_NAME/backend/.env"
cp -r "${REPO_ROOT}/.claude" "$WORKTREE_DIR/$WORKTREE_NAME/.claude"
echo "Worktree '$WORKTREE_NAME' created at '$WORKTREE_DIR/$WORKTREE_NAME'"
echo "run to enter worktree:
``````````

    cd $WORKTREE_DIR/$WORKTREE_NAME
``````````
"
