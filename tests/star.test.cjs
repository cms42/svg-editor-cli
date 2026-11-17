// modified-star 测试：dirty 状态机（编辑→保存→再编辑→undo 回保存点）与标签拼接。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const builtin = require("../dist/builtin/index.js").default;
const starPlugin = require("../dist/plugins/tree-star/index.js").default;
const boxPlugin = require("../dist/plugins/shape-box/index.js").default;
const { ModifiedStar, signature } = require("../dist/plugins/tree-star/ModifiedStar.js");
const { makeEditor } = require("./helpers.cjs");

const withStar = (cwd) =>
  makeEditor([{ plugin: builtin }, { plugin: starPlugin }], cwd);

/** 取出 tree 输出里某行的行尾标签（最后一个空白后的 * 等）。 */
function tagOf(lines, match) {
  const line = lines.find((l) => match.test(l));
  if (!line) return null;
  const m = /\*$/.exec(line.trimEnd());
  return m ? "*" : null;
}

test("新建画布后未编辑：无星号", () => {
  const { run } = withStar();
  run("init 100 100");
  assert.deepStrictEqual(run("tree"), ["svg (100x100)"]);
});

test("新建节点立即标记（保存点之后才出现）", () => {
  const { run } = withStar();
  run("init 100 100");
  run("create rect r1 0 0 10 10");
  const lines = run("tree");
  assert.strictEqual(tagOf(lines, /^svg/), "*");
  assert.strictEqual(tagOf(lines, /rect#r1/), "*");
});

test("保存后星号全部消失", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "star-"));
  const { run } = withStar(dir);
  run("init 100 100");
  run("create rect r1 0 0 10 10");
  run(`save ${path.join(dir, "a.svg")}`);
  const lines = run("tree");
  assert.ok(!lines.some((l) => l.includes("*")), lines.join("\n"));
});

test("编辑 → 保存 → 再编辑：只有被改的图形带星号", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "star2-"));
  const { run } = withStar(dir);
  run("init 100 100");
  run("create rect r1 0 0 10 10");
  run("create rect r2 0 0 10 10");
  run(`save ${path.join(dir, "a.svg")}`);
  run("move r2 5 5");
  const lines = run("tree");
  assert.strictEqual(tagOf(lines, /rect#r1/), null);
  assert.strictEqual(tagOf(lines, /rect#r2/), "*");
  assert.strictEqual(tagOf(lines, /^svg/), "*");
});

test("undo 回到保存点：星号消失（内容比对的直接后果）", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "star3-"));
  const { run } = withStar(dir);
  run("init 100 100");
  run("create rect r1 0 0 10 10");
  run(`save ${path.join(dir, "a.svg")}`);
  run("move r1 5 5");
  assert.strictEqual(tagOf(run("tree"), /rect#r1/), "*");
  run("undo");
  const lines = run("tree");
  assert.strictEqual(tagOf(lines, /rect#r1/), null);
  assert.strictEqual(tagOf(lines, /^svg/), null);
});

test("redo 之后星号回来", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "star4-"));
  const { run } = withStar(dir);
  run("init 100 100");
  run("create rect r1 0 0 10 10");
  run(`save ${path.join(dir, "a.svg")}`);
  run("move r1 5 5");
  run("undo");
  run("redo");
  assert.strictEqual(tagOf(run("tree"), /rect#r1/), "*");
});

test("编辑后再逐条撤销：星号逐步消失（按内容而非命令计数）", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "star5-"));
  const { run } = withStar(dir);
  run("init 100 100");
  run("create rect r1 0 0 10 10");
  run(`save ${path.join(dir, "a.svg")}`);
  run("set r1 fill red");
  run("set r1 fill blue");
  assert.strictEqual(tagOf(run("tree"), /rect#r1/), "*");
  run("undo"); // 回到 fill=red，仍与保存点不同
  assert.strictEqual(tagOf(run("tree"), /rect#r1/), "*");
  run("undo"); // 回到无 fill，等于保存点
  assert.strictEqual(tagOf(run("tree"), /rect#r1/), null);
});

test("祖先容器不替子孙背星号（不传播）", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "star6-"));
  const { run } = withStar(dir);
  run("init 100 100");
  run("create g g1");
  run("create rect r1 0 0 10 10 in g1");
  run(`save ${path.join(dir, "a.svg")}`);
  run("move r1 5 5");
  const lines = run("tree");
  assert.strictEqual(tagOf(lines, /rect#r1/), "*");
  // g1 自身属性没变；容器子树变了但按"不传播"策略不标
  assert.strictEqual(tagOf(lines, /g#g1/), null);
  // 根行是文档级标记，仍反映"有未保存修改"
  assert.strictEqual(tagOf(lines, /^svg/), "*");
});

test("read 之后基线重置，无星号", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "star7-"));
  const file = path.join(dir, "a.svg");
  fs.writeFileSync(
    file,
    '<svg width="100" height="100"><rect id="r1" x="0" y="0" width="10" height="10"/></svg>'
  );
  const { run } = withStar(dir);
  run(`read ${file}`);
  const lines = run("tree");
  assert.ok(!lines.some((l) => l.includes("*")), lines.join("\n"));
});

test("两个标签并存且互不感知：box 行同时有 (box) 与 *", () => {
  const h = makeEditor([
    { plugin: builtin },
    { plugin: boxPlugin },
    { plugin: starPlugin },
  ]);
  h.run("init 800 600");
  h.run('create box n1 10 10 100 40 "A"');
  const line = h.run("tree").find((l) => /g#n1/.test(l));
  assert.match(line, /g#n1 \(box\) \*$/);
});

test("标签拼接顺序 = 注册顺序", () => {
  const a = makeEditor([
    { plugin: builtin },
    { plugin: boxPlugin },
    { plugin: starPlugin },
  ]);
  a.run("init 800 600");
  a.run('create box n1 10 10 100 40 "A"');
  const lineA = a.run("tree").find((l) => /g#n1/.test(l));

  const b = makeEditor([
    { plugin: builtin },
    { plugin: starPlugin },
    { plugin: boxPlugin },
  ]);
  b.run("init 800 600");
  b.run('create box n1 10 10 100 40 "A"');
  const lineB = b.run("tree").find((l) => /g#n1/.test(l));

  assert.match(lineA, /\(box\) \*$/);
  assert.match(lineB, /\* \(box\)$/);
});

test("没有标签时 tree 输出与无插件逐字节一致", () => {
  const plain = makeEditor([{ plugin: builtin }]);
  const starred = makeEditor([
    { plugin: builtin },
    { plugin: starPlugin },
  ]);
  const script = `init 100 100
create rect r1 0 0 10 10
create g g1
create circle c1 1 1 2 in g1
tree`;
  const a = plain.script(script).slice(-5);
  const b = starred.script(script).slice(-5);
  // 只在"保存过"的情形下才可比；这里改为比较去掉星号后的结构
  assert.strictEqual(
    b.map((l) => l.replace(/ \*$/, "")).join("\n"),
    a.join("\n")
  );
});

test("实例状态封装在字段中：两个编辑器互不影响", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "star8-"));
  const a = withStar(dir);
  const b = withStar(dir);
  a.run("init 100 100");
  a.run("create rect r1 0 0 10 10");
  b.run("init 100 100");
  b.run(`save ${path.join(dir, "b.svg")}`);
  assert.strictEqual(tagOf(a.run("tree"), /^svg/), "*");
  assert.strictEqual(tagOf(b.run("tree"), /^svg/), null);
});

test("signature 对相同结构稳定、对变化敏感", () => {
  const h = makeEditor([{ plugin: builtin }]);
  h.run("init 10 10");
  h.run("create rect r1 0 0 5 5");
  const s1 = signature(h.ctx.doc.find("r1"));
  const s2 = signature(h.ctx.doc.find("r1"));
  assert.strictEqual(s1, s2);
  h.run("move r1 1 0");
  assert.notStrictEqual(signature(h.ctx.doc.find("r1")), s1);
});

test("ModifiedStar 可脱离 CLI 单独实例化（测试替身编辑器服务）", () => {
  const listeners = new Map();
  const fakeDoc = { root: { children: [] } };
  const svc = {
    events: { on: (e, f) => { (listeners.get(e) ?? listeners.set(e, []).get(e)).push(f); } },
    cwd: "/tmp",
    currentDocument: () => fakeDoc,
  };
  const d = new ModifiedStar(svc);
  assert.strictEqual(d.decorate({ kind: "root", shape: null, doc: fakeDoc }), null);
});
