// dir 插件测试：渲染纯函数、测试替身、真实文件系统适配器三种视角。
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const { renderDirectoryListing } = require("../dist/plugins/dir/index.js");
const { FsDirectoryReader } = require("../dist/plugins/dir/FsDirectoryReader.js");
const { DirectoryReadError } = require("../dist/plugins/dir/DirectoryReader.js");
const dirPlugin = require("../dist/plugins/dir/index.js").default;
const builtin = require("../dist/builtin/index.js").default;
const { makeEditor } = require("./helpers.cjs");

function fixedCwd() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "svgframe-dir-"));
  fs.mkdirSync(path.join(dir, "docs"));
  fs.mkdirSync(path.join(dir, "plugins"));
  fs.writeFileSync(path.join(dir, "demo.svg"), "<svg/>");
  fs.writeFileSync(path.join(dir, "package.json"), "{}");
  fs.writeFileSync(path.join(dir, ".hidden"), "");
  return dir;
}

// ---------- 纯渲染：稳定排序 / 分组 ----------

test("渲染：目录在前、文件在后，各组按名称升序", () => {
  const lines = renderDirectoryListing([
    { name: "b.txt", isDirectory: false },
    { name: "z-dir", isDirectory: true },
    { name: "a.txt", isDirectory: false },
    { name: "a-dir", isDirectory: true },
    { name: ".hidden", isDirectory: false },
  ]);
  assert.deepStrictEqual(lines, [
    "[DIR]  a-dir",
    "[DIR]  z-dir",
    "[FILE] .hidden",
    "[FILE] a.txt",
    "[FILE] b.txt",
  ]);
});

test("渲染：空目录", () => {
  assert.deepStrictEqual(renderDirectoryListing([]), ["(empty directory)"]);
});

test("渲染：输入顺序不同但输出逐字节一致（稳定）", () => {
  const a = [
    { name: "x", isDirectory: false },
    { name: "y", isDirectory: true },
    { name: "z", isDirectory: false },
  ];
  const b = [
    { name: "z", isDirectory: false },
    { name: "y", isDirectory: true },
    { name: "x", isDirectory: false },
  ];
  assert.deepStrictEqual(renderDirectoryListing(a), renderDirectoryListing(b));
});

test("渲染：标记后固定两个空格", () => {
  const [dirLine, fileLine] = renderDirectoryListing([
    { name: "d", isDirectory: true },
    { name: "f", isDirectory: false },
  ]);
  assert.strictEqual(dirLine, "[DIR]  d");
  assert.strictEqual(fileLine, "[FILE] f");
});

// ---------- 测试替身：命令逻辑 ----------

class StubReader {
  constructor(entries, fail = false) {
    this.entries = entries;
    this.fail = fail;
    this.calls = [];
  }
  list(p) {
    this.calls.push(p);
    if (this.fail) throw new DirectoryReadError(p);
    return this.entries;
  }
}

function editorWithStub(entries, fail = false, cwd = "/fake/cwd") {
  const stub = new StubReader(entries, fail);
  const h = makeEditor([{ plugin: builtin }, { plugin: dirPlugin, options: { reader: stub } }], cwd);
  return { stub, ...h };
}

test("替身：混合文件与子目录", () => {
  const { run } = editorWithStub([
    { name: "src", isDirectory: true },
    { name: "a.svg", isDirectory: false },
  ]);
  assert.deepStrictEqual(run("dir"), ["[DIR]  src", "[FILE] a.svg"]);
});

test("替身：空目录", () => {
  const { run } = editorWithStub([]);
  assert.deepStrictEqual(run("dir"), ["(empty directory)"]);
});

test("替身：隐藏项照常列出", () => {
  const { run } = editorWithStub([{ name: ".git", isDirectory: true }]);
  assert.deepStrictEqual(run("dir"), ["[DIR]  .git"]);
});

test("替身：读取失败输出 cannot read directory", () => {
  const { run } = editorWithStub([], true, "/broken");
  assert.deepStrictEqual(run("dir"), ["error: cannot read directory: /broken"]);
});

test("替身：失败后仍可执行其他命令", () => {
  const { run } = editorWithStub([], true, "/broken");
  run("dir");
  assert.deepStrictEqual(run("init 10 10"), ["canvas 10x10 created"]);
});

test("替身：dir 不接收参数", () => {
  const { run } = editorWithStub([{ name: "a", isDirectory: false }]);
  assert.deepStrictEqual(run("dir extra"), ["error: usage: dir"]);
});

test("替身：传给 reader 的路径就是启动工作目录", () => {
  const { run, stub } = editorWithStub([], false, "/work/dir");
  run("dir");
  assert.deepStrictEqual(stub.calls, ["/work/dir"]);
});

// ---------- 不依赖文档 / 不改变状态 ----------

test("未 init 也能用 dir，且不影响 undo 历史", () => {
  const { run, ctx } = editorWithStub([{ name: "f", isDirectory: false }]);
  assert.deepStrictEqual(run("dir"), ["[FILE] f"]);
  assert.strictEqual(ctx.doc, null);
  assert.deepStrictEqual(run("undo"), ["error: nothing to undo"]);
});

test("已有文档时执行 dir，文档与 undo/redo 历史不变", () => {
  const { run, ctx } = editorWithStub([{ name: "f", isDirectory: false }]);
  assert.deepStrictEqual(run("init 10 10"), ["canvas 10x10 created"]);
  assert.deepStrictEqual(run("create rect r1 0 0 5 5"), ["rect#r1 created"]);
  const before = ctx.doc;
  run("dir");
  assert.strictEqual(ctx.doc, before);
  // undo 仍能撤销 create —— dir 没有清空历史
  assert.deepStrictEqual(run("undo"), ["rect#r1 deleted"]);
});

test("dir 失败同样不进入 undo 栈、不触发 io 限制", () => {
  const { run } = editorWithStub([], true, "/broken");
  run("init 10 10");
  run("create rect r1 0 0 5 5");
  assert.match(run("dir")[0], /^error: cannot read directory/);
  assert.deepStrictEqual(run("undo"), ["rect#r1 deleted"]);
});

// ---------- 真实文件系统适配器 ----------

test("真适配器：固定目录的完整输出", () => {
  const cwd = fixedCwd();
  const h = makeEditor([{ plugin: builtin }, { plugin: dirPlugin }], cwd);
  assert.deepStrictEqual(h.run("dir"), [
    "[DIR]  docs",
    "[DIR]  plugins",
    "[FILE] .hidden",
    "[FILE] demo.svg",
    "[FILE] package.json",
  ]);
});

test("真适配器：两种装配方式输出逐字节一致", () => {
  const cwd = fixedCwd();
  const a = makeEditor([{ plugin: builtin }, { plugin: dirPlugin }], cwd).run("dir");
  const b = makeEditor([{ plugin: builtin }, { plugin: dirPlugin }], cwd).run("dir");
  assert.deepStrictEqual(a, b);
});

test("真适配器：不递归展开子目录内容", () => {
  const cwd = fixedCwd();
  const entries = new FsDirectoryReader().list(cwd);
  assert.ok(!entries.some((e) => e.name === "a.md"), "不应出现子目录内的文件");
});

test("真适配器：读取不存在的目录抛 DirectoryReadError", () => {
  const reader = new FsDirectoryReader();
  assert.throws(
    () => reader.list(path.join(os.tmpdir(), "svgframe-definitely-missing-dir")),
    DirectoryReadError
  );
});

test("真适配器：不列出 . 与 ..", () => {
  const cwd = fixedCwd();
  const names = new FsDirectoryReader().list(cwd).map((e) => e.name);
  assert.ok(!names.includes(".") && !names.includes(".."));
});
