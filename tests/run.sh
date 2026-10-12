#!/bin/bash
# 验证入口：管道回放各会话脚本，与期望输出逐字节 diff。
# 用法：bash tests/run.sh
set -u
cd "$(dirname "$0")/.."
npm run build --silent || exit 1

fail=0
run_case() {
  local name="$1" session="$2" expected="$3" workdir="$4"
  local actual
  actual=$(cd "$workdir" && node "$OLDPWD/dist/cli/main.js" < "$OLDPWD/$session")
  if [ "$actual" == "$(cat "$expected")" ]; then
    echo "PASS  $name"
  else
    echo "FAIL  $name"
    diff <(echo "$actual") "$expected" | head -40
    fail=1
  fi
}

mkdir -p tests/.tmp
cp examples/other.svg tests/.tmp/

run_case "§6 典型会话"      tests/session_main.txt      tests/expected_main.txt      tests/.tmp
run_case "§6.1 流程图会话"  tests/session_flowchart.txt tests/expected_flowchart.txt tests/.tmp
run_case "§4.2 错误矩阵"    tests/session_errors.txt    tests/expected_errors.txt    tests/.tmp

# round-trip：read other.svg → save roundtrip.svg → 再 read → tree 应与直接 read 的 tree 一致
rt=$(cd tests/.tmp && node "$OLDPWD/dist/cli/main.js" <<'EOF'
read other.svg
save roundtrip.svg
read roundtrip.svg
tree
EOF
)
direct=$(cd tests/.tmp && node "$OLDPWD/dist/cli/main.js" <<'EOF'
read other.svg
tree
EOF
)
# 去掉各自前两行（banner + read 回显），比 tree 部分
if [ "$(echo "$rt" | tail -n +6)" == "$(echo "$direct" | tail -n +4)" ]; then
  echo "PASS  round-trip (read→save→read 结构一致)"
else
  echo "FAIL  round-trip"
  diff <(echo "$rt" | tail -n +6) <(echo "$direct" | tail -n +4)
  fail=1
fi
# round-trip 不产生新的缺 id 警告（save 已写入 id；warning 只能有 other.svg 那一次）
if [ "$(echo "$rt" | grep -c "warning:")" == "1" ]; then
  echo "PASS  round-trip 无重复警告"
else
  echo "FAIL  round-trip 不应有新 warning"
  fail=1
fi

exit $fail
