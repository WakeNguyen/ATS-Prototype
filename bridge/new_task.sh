#!/usr/bin/env bash
set -euo pipefail

# Tao 1 git worktree moi cho 1 task giao cho Antigravity qua bridge Claude<->AG,
# copy san run_demo.sh/fix_demo.sh + pre-approve quyen trong .claude/settings.local.json.
#
# Cach dung (chay tu goc repo ats-web, tren may that - KHONG chay qua Cowork device_bash):
#   ./bridge/new_task.sh <ten-task> [nhanh-goc]
#
# Vi du:
#   ./bridge/new_task.sh expand-timeline
#   ./bridge/new_task.sh fix-login-bug development
#
# Mac dinh worktree tao o thu muc CHA cua repo (dung quy uoc git: worktree la
# sibling, khong nam long trong repo chinh). Muon doi vi tri, set bien moi
# truong WORKTREE_BASE_DIR truoc khi chay, vi du:
#   WORKTREE_BASE_DIR=/d/Users/Orchestrator ./bridge/new_task.sh <ten-task>

usage() {
  echo "Cach dung: $0 <ten-task> [nhanh-goc, mac dinh: development]"
  echo "Vi du:     $0 expand-timeline"
  exit 1
}

TASK_NAME="${1:-}"
BASE_BRANCH="${2:-development}"

[ -z "$TASK_NAME" ] && usage

if [[ ! "$TASK_NAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo "Loi: ten task chi duoc chua chu (khong dau), so, '-' va '_' - khong khoang trang."
  echo "Vi du hop le: expand-timeline, fix-123, socials-json-fix"
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
BRIDGE_DIR="$REPO_ROOT/bridge"
WORKTREE_DIR="${WORKTREE_BASE_DIR:-$(dirname "$REPO_ROOT")}/wt-$TASK_NAME"
BRANCH_NAME="task-$TASK_NAME"

if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
  echo "Loi: nhanh '$BRANCH_NAME' da ton tai. Chon ten task khac, hoac xoa nhanh cu truoc:"
  echo "  git branch -d $BRANCH_NAME"
  exit 1
fi

if [ -e "$WORKTREE_DIR" ]; then
  echo "Loi: '$WORKTREE_DIR' da ton tai. Chon ten task khac hoac don worktree cu truoc:"
  echo "  git worktree remove \"$WORKTREE_DIR\""
  exit 1
fi

echo "==> Cap nhat '$BASE_BRANCH' tu remote..."
git -C "$REPO_ROOT" fetch origin "$BASE_BRANCH" --quiet || echo "   (khong fetch duoc, dung ban local hien co)"

echo "==> Tao worktree tai '$WORKTREE_DIR', nhanh '$BRANCH_NAME' (tu '$BASE_BRANCH')..."
if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/remotes/origin/$BASE_BRANCH"; then
  git -C "$REPO_ROOT" worktree add -B "$BRANCH_NAME" "$WORKTREE_DIR" "origin/$BASE_BRANCH"
else
  git -C "$REPO_ROOT" worktree add -B "$BRANCH_NAME" "$WORKTREE_DIR" "$BASE_BRANCH"
fi

echo "==> Copy run_demo.sh / fix_demo.sh..."
cp "$BRIDGE_DIR/run_demo.sh" "$WORKTREE_DIR/run_demo.sh"
cp "$BRIDGE_DIR/fix_demo.sh" "$WORKTREE_DIR/fix_demo.sh"
chmod +x "$WORKTREE_DIR/run_demo.sh" "$WORKTREE_DIR/fix_demo.sh"

echo "==> Tao .claude/settings.local.json (pre-approve quyen chay script)..."
mkdir -p "$WORKTREE_DIR/.claude"
cat > "$WORKTREE_DIR/.claude/settings.local.json" << JSONEOF
{
  "permissions": {
    "allow": [
      "Bash(./run_demo.sh)",
      "Bash(./fix_demo.sh)",
      "Bash($WORKTREE_DIR/run_demo.sh)",
      "Bash($WORKTREE_DIR/fix_demo.sh)"
    ]
  }
}
JSONEOF

touch "$WORKTREE_DIR/spec.md"

echo ""
echo "OK. Worktree san sang: $WORKTREE_DIR (nhanh $BRANCH_NAME, goc $BASE_BRANCH)"
echo ""
echo "Buoc tiep theo:"
echo "  1. Viet noi dung task vao: $WORKTREE_DIR/spec.md"
echo "  2. Mo VS Code/Antigravity dung TAI folder do lam workspace goc (File -> Open Folder)."
echo "  3. Trong Claude Code, chay: ./run_demo.sh"
echo ""
echo "Don dep sau khi task da merge xong vao $BASE_BRANCH (chay tu $REPO_ROOT, dong VS Code o worktree truoc):"
echo "  git worktree remove \"$WORKTREE_DIR\""
echo "  git branch -d $BRANCH_NAME"
