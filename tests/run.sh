#!/bin/bash
# Phase 1 兼容性验证：内置插件（无任何新增插件）的输出必须与 tag final 逐字节一致。
# 用法：bash tests/run.sh
set -u
cd "$(dirname "$0")/.."
npm run build --silent || exit 1

# 只装内置插件的配置（空 plugins 数组）——这条路径同时验证"配置装配可用"
BASE_CONFIG=doc/transcript/internal-only.json

fail=0
run_case() {
  local name="$1" session="$2" expected="$3" workdir="$4"
  local actual
  actual=$(cd "$workdir" && node "$OLDPWD/dist/cli/main.js" --config "$OLDPWD/$BASE_CONFIG" < "$OLDPWD/$session")
  if [ "$actual" == "$(cat "$expected")" ]; then
    echo "PASS  $name"
  else
    echo "FAIL  $name"
    diff <(echo "$actual") "$expected" | head -40
    fail=1
  fi
}

mkdir -p tests/.tmp
cp examples/other.svg examples/collide.svg tests/.tmp/

run_case "§6 典型会话"      tests/session_main.txt      tests/expected_main.txt      tests/.tmp
run_case "§6.1 流程图会话"  tests/session_flowchart.txt tests/expected_flowchart.txt tests/.tmp
run_case "§4.2 错误矩阵"    tests/session_errors.txt    tests/expected_errors.txt    tests/.tmp
run_case "回归:redo身份/set字符串/in子句/严格数字等" tests/session_regress.txt tests/expected_regress.txt tests/.tmp
run_case "回归:allocId 冲突避让" tests/session_collide.txt tests/expected_collide.txt tests/.tmp
run_case "回归:text 空格 round-trip" tests/session_text.txt tests/expected_text.txt tests/.tmp

# round-trip：read other.svg → save roundtrip.svg → 再 read → tree 应与直接 read 的 tree 一致
rt=$(cd tests/.tmp && node "$OLDPWD/dist/cli/main.js" --config "$OLDPWD/$BASE_CONFIG" <<'EOF'
read other.svg
save roundtrip.svg
read roundtrip.svg
tree
EOF
)
direct=$(cd tests/.tmp && node "$OLDPWD/dist/cli/main.js" --config "$OLDPWD/$BASE_CONFIG" <<'EOF'
read other.svg
tree
EOF
)
if [ "$(echo "$rt" | tail -n +6)" == "$(echo "$direct" | tail -n +4)" ]; then
  echo "PASS  round-trip (read→save→read 结构一致)"
else
  echo "FAIL  round-trip"
  diff <(echo "$rt" | tail -n +6) <(echo "$direct" | tail -n +4)
  fail=1
fi
if [ "$(echo "$rt" | grep -c "warning:")" == "1" ]; then
  echo "PASS  round-trip 无重复警告"
else
  echo "FAIL  round-trip 不应有新 warning"
  fail=1
fi

# 禁用插件框架也能启动（空壳，不崩溃、不报未捕获异常）
if node dist/cli/main.js --no-plugins < /dev/null > /dev/null 2>&1; then
  echo "PASS  禁用全部插件仍能启动"
else
  echo "FAIL  禁用全部插件仍能启动"
  fail=1
fi

exit $fail
