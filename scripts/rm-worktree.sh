#! /usr/bin/env bash

set -e

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <worktree-name>"
    exit 1
fi
# Make sure the worktree exists
if ! git worktree list | grep -q "$1"; then
    echo "Worktree '$1' does not exist."
    exit 1
fi
# Make sure there isn't anything uncommitted in the worktree
if [ -n "$(git -C ".worktrees/$1" status --porcelain)" ]; then
    echo "Worktree '$1' has uncommitted changes. Please commit or stash them before removing the worktree."
    exit 1
fi

WORKTREE_NAME="$1"
REPO_ROOT=$(git rev-parse --show-toplevel)
WORKTREE_DIR="$REPO_ROOT/.worktrees"
git worktree remove "$WORKTREE_DIR/$WORKTREE_NAME"
rm -rf "$WORKTREE_DIR/$WORKTREE_NAME"
echo "Worktree '$WORKTREE_NAME' has been removed."

