#!/bin/bash
# Hook to warn when too many files are uncommitted
# Runs after Edit/Write tool calls

MAX_UNCOMMITTED=5

# Count uncommitted files (modified + untracked)
uncommitted_count=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

if [ "$uncommitted_count" -gt "$MAX_UNCOMMITTED" ]; then
    echo ""
    echo "⚠️  WARNING: You have $uncommitted_count uncommitted files!"
    echo "   STOP and commit your changes before continuing."
    echo "   Run: git status"
    echo ""
    exit 1  # Block the action
fi

exit 0
