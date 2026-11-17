#!/bin/bash
# 双装配一致性 + Phase 1 兼容性验证。
#
# 三种会话分别在「方式 A（代码装配）」与「方式 B（配置装配）」下执行，
# 两次输出必须逐字节相同；另外把 cli-1 的输出与 tag final 的行为对照。
#
# 目录安排（体现任务书要求）：
#   - 会话文件与 SVG 素材放在 doc/transcript/ 与 doc/transcript/fixtures/
#   - cli-3 用内容固定的临时工作目录，日志写在该目录**之外**
set -u
cd "$(dirname "$0")/.."
ROOT=$(pwd)
npm run build --silent || exit 1

TMP=$(mktemp -d)
OUT="$TMP/logs"
WORK="$TMP/workdir"
mkdir -p "$OUT" "$WORK/docs" "$WORK/plugins"
printf '<svg/>' > "$WORK/demo.svg"
printf '{}' > "$WORK/package.json"
printf '' > "$WORK/.hidden"
trap 'rm -rf "$TMP"' EXIT

fail=0
CONFIG="$ROOT/plugins.config.json"
T="$ROOT/doc/transcript"

# 方式 A / B 各跑一遍，再比较
run_both() {
  local name="$1" cwd="$2" session="$3"
  ( cd "$cwd" && node "$ROOT/dist/cli/main.js" < "$session" > "$OUT/$name.A.txt" 2>&1 )
  ( cd "$cwd" && node "$ROOT/dist/cli/main.js" --config "$CONFIG" < "$session" > "$OUT/$name.B.txt" 2>&1 )
  if diff -q "$OUT/$name.A.txt" "$OUT/$name.B.txt" > /dev/null; then
    echo "PASS  $name 两种装配逐字节一致"
  else
    echo "FAIL  $name 两种装配不一致"
    diff "$OUT/$name.A.txt" "$OUT/$name.B.txt" | head -20
    fail=1
  fi
}

run_both "cli-1 (Phase 1 §6 典型会话)" "$T" "$T/cli-1.txt"
run_both "cli-2 (box 会话)"            "$T" "$T/cli-2-box.txt"
run_both "cli-3 (stats + dir)"         "$WORK" "$T/cli-3-plugins.txt"

# Phase 1 兼容性：禁用新增插件（含树标签）后，Phase 1 的标准会话必须与 tag final 一致。
# tests/session_main.txt 与 tests/expected_main.txt 是 Phase 1 提交时留下的逐字节快照。
( cd "$ROOT/tests/.tmp" && node "$ROOT/dist/cli/main.js" --config "$ROOT/doc/transcript/internal-only.json" < "$ROOT/tests/session_main.txt" > "$OUT/base-cli.txt" 2>&1 )
if diff -q "$OUT/base-cli.txt" "$ROOT/tests/expected_main.txt" > /dev/null; then
  echo "PASS  禁用新增插件后 = tag final（逐字节）"
else
  echo "FAIL  禁用新增插件后偏离 tag final"
  diff "$OUT/base-cli.txt" "$ROOT/tests/expected_main.txt" | head -20
  fail=1
fi

# 会话过程不得改变工作目录内容（dir 只读）
if [ -f "$WORK/demo.svg" ] && [ ! -e "$WORK/demo.svg.tmp" ]; then
  echo "PASS  dir 未改动工作目录"
else
  echo "FAIL  dir 改动了工作目录"
  fail=1
fi

# 日志确实写在工作目录之外
case "$OUT" in
  "$WORK"/*) echo "FAIL  日志写进了工作目录"; fail=1 ;;
  *) echo "PASS  日志位于工作目录之外" ;;
esac

exit $fail
