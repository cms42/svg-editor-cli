// box 插件测试：图形、属性语义、不变量、序列化 round-trip、降级。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const builtin = require("../dist/builtin/index.js").default;
const boxPlugin = require("../dist/plugins/shape-box/index.js").default;
const { BoxShape } = require("../dist/plugins/shape-box/BoxShape.js");
const { SvgSerializer } = require("../dist/kernel/io/SvgSerializer.js");
const { makeEditor } = require("./helpers.cjs");

const withBox = (cwd) => makeEditor([{ plugin: builtin }, { plugin: boxPlugin }], cwd);
const onlyBuiltin = (cwd) => makeEditor([{ plugin: builtin }], cwd);

function tmpFile(name, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "svgframe-box-"));
  const file = path.join(dir, name);
  fs.writeFileSync(file, content, "utf-8");
  return file;
}

// ---------- 创建与结构 ----------

test("create box 产生容器 + 一个矩形 + 一个文字", () => {
  const { run, ctx } = withBox();
  run("init 800 600");
  assert.deepStrictEqual(run('create box n1 120 100 160 60 "开始"'), ["box#n1 created"]);
  const box = ctx.doc.find("n1");
  assert.ok(box instanceof BoxShape);
  assert.strictEqual(box.children.length, 2);
  assert.deepStrictEqual(
    box.children.map((c) => `${c.tag}#${c.id}`),
    ["rect#n1-rect", "text#n1-label"]
  );
});

test("tree 显示 (box) 标注与内联几何", () => {
  const { run } = withBox();
  run("init 800 600");
  run('create box n1 120 100 160 60 "开始"');
  const lines = run("tree");
  assert.strictEqual(lines[0], "svg (800x600)");
  assert.match(lines[1], /g#n1 \(box\)/);
  assert.match(lines[2], /rect#n1-rect\s+x=120 y=100 w=160 h=60/);
  assert.match(lines[3], /text#n1-label\s+\(140,135\) "开始"/);
});

test("in 子句：box 可挂进容器，也可被 in 到 box 里", () => {
  const { run } = withBox();
  run("init 800 600");
  run("create g outer");
  run('create box n1 10 10 100 40 "A" in outer');
  run('create box n2 20 20 50 20 "B" in n1');
  const tree = run("tree").join("\n");
  assert.match(tree, /g#outer/);
  assert.match(tree, /g#n2 \(box\)/);
});

test("move 按容器语义整体平移", () => {
  const { run, ctx } = withBox();
  run("init 800 600");
  run('create box n1 10 10 100 40 "A"');
  assert.deepStrictEqual(run("move n1 5 5"), ["box#n1 moved by (5,5)"]);
  const box = ctx.doc.find("n1");
  assert.strictEqual(box.boxRect.x, 15);
  assert.strictEqual(box.boxLabel.x, 35);
});

test("scale 递归到子部件", () => {
  const { run, ctx } = withBox();
  run("init 800 600");
  run('create box n1 10 10 100 40 "A"');
  run("scale n1 2");
  const box = ctx.doc.find("n1");
  assert.strictEqual(box.boxRect.width, 200);
  // 标题在 (10+20, 10+35)，随容器整体翻倍
  assert.strictEqual(box.boxLabel.x, 60);
  assert.strictEqual(box.boxLabel.y, 90);
});

// ---------- 属性领域语义 ----------

test("set fill 传播到内部矩形", () => {
  const { run, ctx } = withBox();
  run("init 10 10");
  run('create box n1 0 0 100 40 "A"');
  assert.deepStrictEqual(run("set n1 fill #f5a623"), [
    "box#n1 fill propagated to n1-rect",
  ]);
  assert.strictEqual(ctx.doc.find("n1-rect").fill, "#f5a623");
});

test("set label 改写内部文字", () => {
  const { run, ctx } = withBox();
  run("init 10 10");
  run('create box n1 0 0 100 40 "A"');
  assert.deepStrictEqual(run('set n1 label "处理数据 v2"'), [
    'box#n1 label updated: "处理数据 v2"',
  ]);
  assert.strictEqual(ctx.doc.find("n1-label").textContent(), "处理数据 v2");
});

test("fill 两次 set 各自是一个 undo 单元", () => {
  const { run, ctx } = withBox();
  run("init 10 10");
  run('create box n1 0 0 100 40 "A"');
  run("set n1 fill red");
  run("set n1 fill blue");
  run("undo");
  assert.strictEqual(ctx.doc.find("n1-rect").fill, "red");
  run("redo");
  assert.strictEqual(ctx.doc.find("n1-rect").fill, "blue");
});

test("label 的 undo/redo 各一次即整体恢复", () => {
  const { run, ctx } = withBox();
  run("init 10 10");
  run('create box n1 0 0 100 40 "A"');
  run('set n1 label "B"');
  assert.deepStrictEqual(run("undo"), ['box#n1 label restored: "A"']);
  assert.strictEqual(ctx.doc.find("n1-label").textContent(), "A");
  run("redo");
  assert.strictEqual(ctx.doc.find("n1-label").textContent(), "B");
});

test("未设置过 fill 时 undo 还原为未设置", () => {
  const { run, ctx } = withBox();
  run("init 10 10");
  run('create box n1 0 0 100 40 "A"');
  run("set n1 fill red");
  run("undo");
  assert.strictEqual(ctx.doc.find("n1-rect").fill, null);
});

test("普通图形无处理器命中时仍走默认白名单", () => {
  const { run } = withBox();
  run("init 10 10");
  run("create rect r1 0 0 5 5");
  assert.deepStrictEqual(run("set r1 fill red"), ["rect#r1 updated: fill=red"]);
  assert.deepStrictEqual(run("set r1 label x"), ["error: unknown attribute: label"]);
});

test("box 上的未知属性回落到默认规则并报错", () => {
  const { run } = withBox();
  run("init 10 10");
  run('create box n1 0 0 100 40 "A"');
  assert.deepStrictEqual(run("set n1 stroke-width 3"), [
    "g#n1 updated: stroke-width=3",
  ]);
  assert.deepStrictEqual(run("set n1 nonsense 1"), ["error: unknown attribute: nonsense"]);
});

// ---------- 处理器失败回滚 ----------

test("处理器部分修改后抛错：文档与 undo 历史都不变", () => {
  const h = withBox();
  h.run("init 10 10");
  h.run('create box n1 0 0 100 40 "A"');
  const box = h.ctx.doc.find("n1");
  const beforeFill = box.boxRect.fill;
  const beforeLabel = box.boxLabel.textContent();

  // 注入一个"改一半就抛错"的处理器，模拟 handler 内部故障
  h.ctx.attributes.register({
    name: "boom",
    handles: (s, attr) => s === box && attr === "boom",
    apply(_s, _a, _v, tx) {
      tx.set(box.boxRect, "fill", "red");
      tx.set(box.boxLabel, "text", "exploded");
      throw new Error("handler blew up");
    },
  });

  assert.deepStrictEqual(h.run("set n1 boom x"), ["error: handler blew up"]);
  assert.strictEqual(box.boxRect.fill, beforeFill);
  assert.strictEqual(box.boxLabel.textContent(), beforeLabel);
  // 历史未被污染：undo 撤回的是 create
  assert.deepStrictEqual(h.run("undo"), ["box#n1 deleted"]);
});

// ---------- 不变量：子部件不可单独摘下 ----------

test("ungroup 拒绝复合图形", () => {
  const { run } = withBox();
  run("init 10 10");
  run('create box n1 0 0 100 40 "A"');
  assert.deepStrictEqual(run("ungroup n1"), ["error: cannot ungroup composite shape: n1"]);
});

test("delete 拒绝删除必要子部件", () => {
  const { run } = withBox();
  run("init 10 10");
  run('create box n1 0 0 100 40 "A"');
  assert.deepStrictEqual(run("delete n1-rect"), [
    "error: cannot detach required child of composite shape: n1-rect",
  ]);
  assert.deepStrictEqual(run("delete n1-label"), [
    "error: cannot detach required child of composite shape: n1-label",
  ]);
});

test("addto / group 也拒绝移走必要子部件", () => {
  const { run } = withBox();
  run("init 10 10");
  run('create box n1 0 0 100 40 "A"');
  run("create g g1");
  assert.match(run("addto g1 n1-rect")[0], /cannot detach required child/);
  assert.match(run("group g2 n1-label")[0], /cannot detach required child/);
});

test("整体 delete box 合法，一个 undo 单元恢复全部", () => {
  const { run, ctx } = withBox();
  run("init 10 10");
  run('create box n1 0 0 100 40 "A"');
  assert.deepStrictEqual(run("delete n1"), ["g#n1 deleted"]);
  assert.strictEqual(ctx.doc.has("n1-rect"), false);
  run("undo");
  assert.ok(ctx.doc.find("n1") instanceof BoxShape);
  assert.ok(ctx.doc.has("n1-rect"));
});

// ---------- 创建期 id 冲突 ----------

test("子部件 id 冲突时整条命令失败，不留半个 box", () => {
  const { run, ctx } = withBox();
  run("init 10 10");
  run("create rect n1-rect 0 0 1 1");
  assert.deepStrictEqual(run('create box n1 0 0 100 40 "A"'), [
    "error: id already exists: n1-rect",
  ]);
  assert.strictEqual(ctx.doc.has("n1"), false);
  assert.strictEqual(ctx.doc.has("n1-label"), false);
});

test("label 子部件 id 冲突同样拒绝", () => {
  const { run, ctx } = withBox();
  run("init 10 10");
  run('create text n1-label 0 0 "x"');
  assert.deepStrictEqual(run('create box n1 0 0 100 40 "A"'), [
    "error: id already exists: n1-label",
  ]);
  assert.strictEqual(ctx.doc.has("n1"), false);
});

// ---------- 序列化与读回 ----------

test("序列化带 data-kind=box，读回还原为 box", () => {
  const { run, ctx } = withBox();
  run("init 400 300");
  run('create box n1 20 20 100 40 "A"');
  const xml = new SvgSerializer().serialize(ctx.doc);
  assert.match(xml, /<g id="n1" data-kind="box">/);

  const file = tmpFile("b.svg", xml);
  const h2 = withBox();
  h2.run(`read ${file}`);
  const box = h2.ctx.doc.find("n1");
  assert.ok(box instanceof BoxShape);
  assert.strictEqual(box.boxLabel.textContent(), "A");
});

test("读回后 tree 与创建时一致", () => {
  const { run, ctx } = withBox();
  run("init 400 300");
  run('create box n1 20 20 100 40 "A"');
  const before = run("tree").slice(1);
  const file = tmpFile("b2.svg", new SvgSerializer().serialize(ctx.doc));
  const h2 = withBox();
  h2.run(`read ${file}`);
  // 第二个编辑器没有 box 标签插件以外的东西，tree 行应一致
  assert.deepStrictEqual(h2.run("tree").slice(1), before);
});

test("未装 box 插件：data-kind 被忽略，降级为普通 g 并警告", () => {
  const file = tmpFile(
    "plain.svg",
    '<svg width="100" height="100"><g id="n1" data-kind="box">' +
      '<rect id="n1-rect" x="0" y="0" width="10" height="10"/>' +
      '<text id="n1-label" x="2" y="8">A</text></g></svg>'
  );
  const h = onlyBuiltin();
  const out = h.run(`read ${file}`);
  assert.ok(out.some((l) => /unsupported kind box/.test(l)), out.join("\n"));
  assert.ok(!(h.ctx.doc.find("n1") instanceof BoxShape));
  assert.strictEqual(h.ctx.doc.find("n1").children.length, 2);
});

test("残缺 box：整份读入失败，原文档保持不变", () => {
  const file = tmpFile(
    "bad.svg",
    '<svg width="100" height="100"><g id="x" data-kind="box">' +
      '<rect id="x-rect" x="0" y="0" width="10" height="10"/></g></svg>'
  );
  const h = withBox();
  h.run("init 50 50");
  h.run("create rect keep 0 0 5 5");
  const before = h.ctx.doc;
  const out = h.run(`read ${file}`);
  assert.match(out[0], /^error: cannot parse .*box x must have exactly 2 children/);
  assert.strictEqual(h.ctx.doc, before);
  assert.ok(h.ctx.doc.has("keep"));
});

test("box 子部件类型不对：整份读入失败", () => {
  const file = tmpFile(
    "bad2.svg",
    '<svg width="100" height="100"><g id="x" data-kind="box">' +
      '<rect id="x-rect" x="0" y="0" width="10" height="10"/>' +
      '<circle id="x-label" cx="0" cy="0" r="1"/></g></svg>'
  );
  const h = withBox();
  const out = h.run(`read ${file}`);
  assert.match(out[0], /must contain <rect>\+<text>/);
});

test("box 子部件 id 与已有 id 冲突：整份读入失败", () => {
  const file = tmpFile(
    "dup.svg",
    '<svg width="100" height="100">' +
      '<rect id="n1-rect" x="0" y="0" width="5" height="5"/>' +
      '<g id="n1" data-kind="box"><rect id="n1-rect" x="0" y="0" width="10" height="10"/>' +
      '<text id="n1-label" x="0" y="0">A</text></g></svg>'
  );
  const h = withBox();
  const out = h.run(`read ${file}`);
  assert.match(out[0], /^error: cannot parse/);
});

// ---------- 插件独立可测 ----------

test("box 插件可单独装在空内核上（不依赖其他插件）", () => {
  const h = makeEditor([{ plugin: boxPlugin }]);
  // 没有 init 命令，但插件本身装载成功且贡献了三类注册
  assert.deepStrictEqual(h.errors, []);
  assert.strictEqual(h.ctx.shapes.get("box").type, "box");
  assert.deepStrictEqual(h.ctx.attributes.names(), ["box-attributes"]);
  assert.deepStrictEqual(h.ctx.decorators.names(), ["box-type-label"]);
});
