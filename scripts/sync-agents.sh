#!/usr/bin/env bash
# Sync CLAUDE.md files to AGENTS.md for OpenAI Codex compatibility
#
# Claude Code uses:
#   - /CLAUDE.md (root)
#   - /.claude/CLAUDE.md (special dir, merged into context)
#   - /*/CLAUDE.md (subdirectories)
#
# OpenAI Codex uses:
#   - /AGENTS.md (root) - no .codex/ equivalent at project level
#   - /*/AGENTS.md (subdirectories)
#
# This script:
#   1. Merges /CLAUDE.md + /.claude/CLAUDE.md → /AGENTS.md
#   2. Copies all other CLAUDE.md → AGENTS.md in same location

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo "Syncing CLAUDE.md → AGENTS.md..."

# 1. Root: merge CLAUDE.md + .claude/CLAUDE.md (idempotent - always recreates)
if [[ -f "CLAUDE.md" ]]; then
  echo "  Creating /AGENTS.md (merged from CLAUDE.md + .claude/CLAUDE.md)"

  # Create fresh file with root CLAUDE.md
  cat CLAUDE.md > AGENTS.md

  # Append .claude/CLAUDE.md if it exists
  if [[ -f ".claude/CLAUDE.md" ]]; then
    echo "" >> AGENTS.md
    cat .claude/CLAUDE.md >> AGENTS.md
  fi
fi

# 2. Subdirectories: direct copy
find . -name "CLAUDE.md" -type f \
  -not -path "./CLAUDE.md" \
  -not -path "./.claude/*" \
  -not -path "./node_modules/*" \
  -not -path "./.git/*" | while read -r claude_file; do

  dir=$(dirname "$claude_file")
  agents_file="$dir/AGENTS.md"

  echo "  Copying $claude_file → $agents_file"
  cp "$claude_file" "$agents_file"
done

echo "Done."
