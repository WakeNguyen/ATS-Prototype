#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
LOG="orchestration_log.md"
STATE="orchestration_round.txt"
MAX_ROUNDS=10
WARN_ROUND=5
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

ROUND=$(cat "$STATE" 2>/dev/null || echo 1)
ROUND=$((ROUND + 1))

if [ "$ROUND" -gt "$MAX_ROUNDS" ]; then
  {
    echo ""
    echo "---"
    echo "### [$TS] HARD CAP - round $ROUND vuot gioi han $MAX_ROUNDS"
    echo "Task CHUA hoan tat sau $MAX_ROUNDS vong trao doi. Dung cung tai day."
    echo "Claude can doc lai toan bo $LOG, viet bao cao tom tat ly do chua xong,"
    echo "va ban giao quyet dinh tiep theo cho PO - KHONG tu y chay them vong nao."
  } >> "$LOG"
  echo "HARD_CAP_REACHED ROUND=$ROUND"
  exit 99
fi

echo "$ROUND" > "$STATE"

{
  echo ""
  echo "---"
  echo "### [$TS] Claude -> Antigravity (round $ROUND/$MAX_ROUNDS, fix instruction)"
  echo '```'
  cat fix_instruction.md
  echo '```'
} >> "$LOG"

if [ "$ROUND" -ge "$WARN_ROUND" ]; then
  echo "WARNING [$TS]: vong $ROUND/$MAX_ROUNDS - dai hon thong le du an (thuong 1-2 vong). Can nhac dung, xem lai spec thay vi tiep tuc." >> "$LOG"
fi

# --print-timeout 15m tranh cat ngang giua chung khi 1 round chay lau (vd npm run
# build/test). timeout 960 (outer safety net) > 15m + du thoi gian cho cac lenh
# xac minh khac trong round.
set +e
timeout 960 agy -p "$(cat fix_instruction.md)" --continue --output-format text --print-timeout 15m --dangerously-skip-permissions --add-dir "$(pwd)" > agy_fix.log 2>&1
EXIT=$?
set -e

{
  echo ""
  echo "### [$TS] Antigravity -> Claude (response, exit=$EXIT)"
  echo '```'
  cat agy_fix.log
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

echo "EXIT=$EXIT ROUND=$ROUND"
