// stats 插件测试：计数规则、类型顺序、空文档、不进入 undo 栈。
const test = require("node:test");
const assert = require("node:assert");

const builtin = require("../dist/builtin/index.js").default;
const statsPlugin = require("../dist/plugins/stats/index.js").default;
const boxPlugin = require("../dist/plugins/shape-box/index.js").default;
const { makeEditor } = require("./helpers.cjs");

const onlyBuiltin = () => makeEditor([{ plugin: builtin }]);
const withStats = () => makeEditor([{ plugin: builtin }, { plugin: statsPlugin }]);

test("空文档：只输出汇总段", () => {
  const { run } = withStats();
  run("init 100 100");
  assert.deepStrictEqual(run("stats"), ["(total 0, containers 0)"]);
});

test("没有文档也不报未知命令", () => {
  const { run } = withStats();
  assert.deepStrictEqual(run("stats"), ["(total 0, containers 0)"]);
});

test("叶子按类型计数，类型顺序为首次出现顺序", () => {
  const { run } = withStats();
  run("init 800 600");
  run("create rect bg 0 0 800 600");
  run('create text title 20 40 "t"');
  run("create circle c1 10 10 5");
  run("create rect r2 0 0 5 5");
  assert.deepStrictEqual(run("stats"), ["rect: 2  text: 1  circle: 1  (total 4, containers 0)"]);
});

test("容器计入 containers 不计入叶子；根 svg 不计入", () => {
  const { run } = withStats();
  run("init 800 600");
  run("create g outer");
  run("create g inner in outer");
  run("create rect r1 0 0 5 5 in inner");
  assert.deepStrictEqual(run("stats"), ["rect: 1  (total 1, containers 2)"]);
});

test("深度优先顺序：容器内先计其子孙", () => {
  const { run } = withStats();
  run("init 100 100");
  run("create g g1");
  run("create circle c1 0 0 1 in g1");
  run("create text t1 0 0 \"x\"");
  assert.deepStrictEqual(run("stats"), [
    "circle: 1  text: 1  (total 2, containers 1)",
  ]);
});

test("stats 不进入 undo 栈", () => {
  const { run } = withStats();
  run("init 10 10");
  run("create rect r1 0 0 5 5");
  run("stats");
  assert.deepStrictEqual(run("undo"), ["rect#r1 deleted"]);
});

test("stats 出现在 help 中", () => {
  const { run } = withStats();
  const help = run("help").join("\n");
  assert.match(help, /stats\s+count leaf shapes by type/);
});

test("未装载时执行 stats 报未知命令", () => {
  const { run } = onlyBuiltin();
  assert.deepStrictEqual(run("stats"), ["error: unknown command: stats"]);
});

test("box 内部叶子照常计数，box 计入 containers", () => {
  const { run } = makeEditor([
    { plugin: builtin },
    { plugin: boxPlugin },
    { plugin: statsPlugin },
  ]);
  run("init 800 600");
  run('create box n1 10 10 100 40 "A"');
  assert.deepStrictEqual(run("stats"), ["rect: 1  text: 1  (total 2, containers 1)"]);
});
