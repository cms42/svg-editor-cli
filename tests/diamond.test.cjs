// diamond 插件测试：创建、几何、序列化 round-trip、options 覆盖缺省填充。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const builtin = require("../dist/builtin/index.js").default;
const diamondPlugin = require("../dist/plugins/shape-diamond/index.js").default;
const { SvgSerializer } = require("../dist/kernel/io/SvgSerializer.js");
const { makeEditor } = require("./helpers.cjs");

const withDiamond = (options) =>
  makeEditor([{ plugin: builtin }, { plugin: diamondPlugin, options: options ?? {} }]);

function tmpFile(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "svgframe-diamond-"));
  const file = path.join(dir, "d.svg");
  fs.writeFileSync(file, content, "utf-8");
  return file;
}

test("create diamond 生成四个顶点的 polygon", () => {
  const { run, ctx } = withDiamond();
  run("init 400 300");
  assert.deepStrictEqual(run("create diamond d1 100 100 120 60"), ["diamond#d1 created"]);
  const shape = ctx.doc.find("d1");
  assert.strictEqual(shape.tag, "polygon");
  assert.deepStrictEqual(shape.points, [
    [100, 70],
    [160, 100],
    [100, 130],
    [40, 100],
  ]);
});

test("缺省填充由插件决定，可被 options 覆盖", () => {
  const a = withDiamond();
  a.run("init 100 100");
  a.run("create diamond d 50 50 20 20");
  assert.strictEqual(a.ctx.doc.find("d").fill, "#f5a623");

  const b = withDiamond({ fill: "#123456" });
  b.run("init 100 100");
  b.run("create diamond d 50 50 20 20");
  assert.strictEqual(b.ctx.doc.find("d").fill, "#123456");
});

test("显式 fill 优先于插件缺省值", () => {
  const h = withDiamond({ fill: "#123456" });
  h.run("init 100 100");
  h.run("create diamond d 50 50 20 20 red");
  assert.strictEqual(h.ctx.doc.find("d").fill, "red");
});

test("move / scale / set fill 照常生效", () => {
  const { run, ctx } = withDiamond();
  run("init 100 100");
  run("create diamond d 50 50 20 20");
  run("move d 10 0");
  assert.deepStrictEqual(ctx.doc.find("d").points[0], [60, 40]);
  run("scale d 2");
  assert.deepStrictEqual(ctx.doc.find("d").points[0], [120, 80]);
  assert.deepStrictEqual(run("set d fill blue"), ["polygon#d updated: fill=blue"]);
});

test("序列化为 <polygon points=…>，读回还原为 diamond", () => {
  const h = withDiamond();
  h.run("init 200 200");
  h.run("create diamond d 100 100 60 40");
  const xml = new SvgSerializer().serialize(h.ctx.doc);
  assert.match(xml, /<polygon id="d" points="100,80 130,100 100,120 70,100"/);

  const file = tmpFile(xml);
  const h2 = withDiamond();
  h2.run(`read ${file}`);
  assert.strictEqual(h2.ctx.doc.find("d").displayTag, "diamond");
  assert.deepStrictEqual(h2.ctx.doc.find("d").points.length, 4);
});

test("非法 points 读回时报错而非崩溃", () => {
  const file = tmpFile('<svg width="10" height="10"><polygon id="p" points="0,0 1"/></svg>');
  const h = withDiamond();
  const out = h.run(`read ${file}`);
  assert.match(out[0], /^error: cannot parse/);
});

test("未装插件时 polygon 是被忽略的未知元素（不崩溃）", () => {
  const file = tmpFile('<svg width="10" height="10"><polygon id="p" points="0,0 1,0 1,1"/></svg>');
  const h = makeEditor([{ plugin: builtin }]);
  const out = h.run(`read ${file}`);
  assert.ok(out.some((l) => /ignoring unsupported element <polygon>/.test(l)), out.join("\n"));
});
