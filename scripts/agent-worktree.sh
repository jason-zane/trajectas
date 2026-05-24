#!/usr/bin/env bash
# Create a git worktree for agent work so parallel sessions don't clobber
# each other. See AGENTS.md → "Workspace isolation".
#
# Usage:
#   scripts/agent-worktree.sh <branch-name>
#   scripts/agent-worktree.sh fix/login-otp-autosubmit
#
# Effect:
#   - fetches origin/main
#   - creates .claude/worktrees/<branch-slug>/ pinned to a new branch
#     branched from origin/main
#   - prints the absolute path of the worktree (cd into it as your next step)
#
# Cleanup after the related PR is merged:
#   git worktree remove .claude/worktrees/<branch-slug>
#   git branch -D <branch-name>      # local branch is now orphaned

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <branch-name>" >&2
  echo "example: $0 fix/login-otp-autosubmit" >&2
  exit 64
fi

BRANCH="$1"

if [[ ! "$BRANCH" =~ ^[a-z0-9._/-]+$ ]]; then
  echo "error: branch name must match [a-z0-9._/-]+ (got: $BRANCH)" >&2
  exit 64
fi

# Resolve repo root so the script works from any cwd inside the repo.
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Slug for the on-disk path — slashes become dashes so the path is flat.
SLUG="${BRANCH//\//-}"
WORKTREE_PATH=".claude/worktrees/${SLUG}"

if [[ -e "$WORKTREE_PATH" ]]; then
  echo "error: $WORKTREE_PATH already exists. Either reuse it, or run:" >&2
  echo "  git worktree remove $WORKTREE_PATH" >&2
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  echo "error: branch '$BRANCH' already exists locally. Pick a different name" >&2
  echo "or delete the existing one first: git branch -D $BRANCH" >&2
  exit 1
fi

echo "→ fetching origin/main"
git fetch origin main --quiet

mkdir -p .claude/worktrees

echo "→ creating worktree at ${WORKTREE_PATH} on new branch ${BRANCH}…"
git worktree add -b "$BRANCH" "$WORKTREE_PATH" origin/main

ABS_PATH="$(cd "$WORKTREE_PATH" && pwd)"
echo ""
echo "✓ worktree ready"
echo "  path:   $ABS_PATH"
echo "  branch: ${BRANCH} (tracks: -, push with -u origin ${BRANCH})"
echo ""
echo "Next: 'cd $ABS_PATH' and do all subsequent work there."
