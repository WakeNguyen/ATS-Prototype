#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
LOG="orchestration_log.md"
STATE="orchestration_round.txt"
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "1" > "$STATE"   # task moi -> round 1

{
  echo ""
  echo "---"
  echo "### [$TS] Claude -> Antigravity (round 1/10, spec sent)"
  echo '```'
  cat spec.md
  echo '```'
} >> "$LOG"

# Goi agy TRUC TIEP, khong can wrapper TTY (script/winpty). --print-timeout 15m de
# tranh cat ngang giua chung khi 1 round chay lau (vd npm run build/test). timeout
# 960 (outer safety net) > 15m + du thoi gian cho cac lenh xac minh khac trong round.
set +e
timeout 960 agy -p "$(cat spec.md)" --output-format text --print-timeout 15m --dangerously-skip-permissions --add-dir "$(pwd)" > agy_run.log 2>&1
EXIT=$?
set -e

{
  echo ""
  echo "### [$TS] Antigravity -> Claude (response, exit=$EXIT)"
  echo '```'
  cat agy_run.log
  echo '```'
} >> "$LOG"

# Tu dong luu 1 ban sao toan bo log cua task nay vao thu muc CHA cua repo (dung
# chung cho moi worktree bridge, ton tai doc lap voi vong doi cua tung worktree/
# nhanh - khong bi mat khi `git worktree remove` don dep sau nay). Ten file dat
# theo ten nhanh git de khong bi ghi de giua cac task khac nhau.
COLLAB_HISTORY_DIR="$(dirname "$(pwd)")/AI Collab History"
mkdir -p "$COLLAB_HISTORY_DIR" 2>/dev/null || true
TASK_BRANCH=$(git branch --show-current 2>/dev/null || basename "$(pwd)")
cp "$LOG" "$COLLAB_HISTORY_DIR/${TASK_BRANCH}_orchestration_log.md" 2>/dev/null || true

echo "EXIT=$EXIT ROUND=1"
