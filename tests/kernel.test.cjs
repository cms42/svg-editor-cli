// 内核 / 插件契约测试（加载器、注册、回滚、扩展点）。
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const { createEditor } = require("../dist/assembly/Editor.js");
const { loadFromConfig } = require("../dist/assembly/ConfigAssembly.js");
const { parsePluginConfig, loadPluginModule } = require("../dist/assembly/PluginLoader.js");
const builtin = require("../dist/builtin/index.js").default;
const { makeEditor } = require("./helpers.cjs");

const FIXTURES = path.join(__dirname, "fixtures");

/** 把 fixtures 里的插件拷到临时目录，配置里的相对路径因此以该目录为基准。 */
function editorWithConfig(configObj) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "svgframe-cfg-"));
  for (const f of fs.readdirSync(FIXTURES)) {
    if (f.endsWith(".js")) fs.copyFileSync(path.join(FIXTURES, f), path.join(dir, f));
  }
  const file = path.join(dir, "plugins.config.json");
  fs.writeFileSync(file, JSON.stringify(configObj), "utf-8");
  const editor = createEditor(dir);
  return { editor, file, dir };
}

// ---------- 加载器四条失败路径 ----------

test("加载器：模块找不到", async () => {
  const { editor, file } = editorWithConfig({ plugins: [{ module: "./nope.js" }] });
  await loadFromConfig(editor, file);
  assert.ok(
    editor.startupErrors.some((l) => l.startsWith("error: plugin not found: ./nope.js")),
    editor.startupErrors.join("\n")
  );
});

test("加载器：没有默认导出", async () => {
  const { editor, file } = editorWithConfig({ plugins: [{ module: "./no-default.js" }] });
  await loadFromConfig(editor, file);
  assert.ok(
    editor.startupErrors.includes("error: plugin has no default export: ./no-default.js"),
    editor.startupErrors.join("\n")
  );
});

test("加载器：清单不一致（声明了未注册）", async () => {
  const { editor, file } = editorWithConfig({ plugins: [{ module: "./mismatch.js" }] });
  await loadFromConfig(editor, file);
  const line = editor.startupErrors.find((l) => l.includes("manifest mismatch"));
  assert.ok(line, editor.startupErrors.join("\n"));
  assert.match(line, /@test\/mismatch/);
  assert.match(line, /declared but not registered \[bar\]/);
});

test("加载器：activate 抛错", async () => {
  const { editor, file } = editorWithConfig({ plugins: [{ module: "./throws-on-activate.js" }] });
  await loadFromConfig(editor, file);
  assert.ok(
    editor.startupErrors.includes("error: plugin failed to activate: @test/throws (kaboom)"),
    editor.startupErrors.join("\n")
  );
});

test("加载器：模块求值失败不得误报为找不到", async () => {
  const { editor, file } = editorWithConfig({ plugins: [{ module: "./throws-on-eval.js" }] });
  await loadFromConfig(editor, file);
  const line = editor.startupErrors[0];
  assert.match(line, /plugin failed to activate/);
  assert.ok(!line.includes("plugin not found"), line);
});

test("加载器：配置结构不合法 → invalid plugin config", async () => {
  for (const bad of [
    { plugins: "nope" },
    { plugins: [{ module: 123 }] },
    { plugins: [{ module: "x", enabled: "yes" }] },
    [],
  ]) {
    const { editor, file } = editorWithConfig(bad);
    await loadFromConfig(editor, file);
    assert.ok(
      editor.startupErrors.includes("error: invalid plugin config"),
      `${JSON.stringify(bad)} → ${editor.startupErrors.join(" / ")}`
    );
  }
});

test("parsePluginConfig：合法配置补齐 options 缺省值", () => {
  const cfg = parsePluginConfig({ plugins: [{ module: "a" }, { module: "b", enabled: false }] });
  assert.deepStrictEqual(cfg.plugins[0], { module: "a", options: {}, enabled: undefined });
  assert.strictEqual(cfg.plugins[1].enabled, false);
});

test("加载器：enabled:false 完全跳过", async () => {
  const { editor, file } = editorWithConfig({
    plugins: [{ module: "./code-plugin.js", enabled: false }],
  });
  await loadFromConfig(editor, file);
  assert.deepStrictEqual(editor.startupErrors, []);
  assert.ok(!editor.ctx.commands.has("greet"));
});

test("加载器：options 原样透传", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "svgframe-opt-"));
  fs.writeFileSync(
    path.join(dir, "opt-plugin.js"),
    `module.exports = { name: "opt", contributes: { commands: ["opt"] },
       activate(ctx) { globalThis.__optSeen = ctx.options; } };`,
    "utf-8"
  );
  const cfgFile = path.join(dir, "plugins.config.json");
  fs.writeFileSync(
    cfgFile,
    JSON.stringify({ plugins: [{ module: "./opt-plugin.js", options: { fill: "#f5a623" } }] })
  );
  const editor = createEditor(dir);
  await loadFromConfig(editor, cfgFile);
  assert.deepStrictEqual(globalThis.__optSeen, { fill: "#f5a623" });
});

// ---------- 注册冲突与回滚 ----------

test("重复注册：同类同名被拒绝，插件整体不生效", () => {
  const { editor } = makeEditor([{ plugin: builtin }]);
  const dup = {
    name: "@test/dup",
    contributes: { shapes: ["rect"] },
    activate(ctx) {
      ctx.registerShape({
        type: "rect",
        usage: "u",
        parse: () => ({ attrs: new Map() }),
        create: () => null,
      });
    },
  };
  const ok = editor.host.activate(dup);
  assert.strictEqual(ok, false);
  assert.ok(
    editor.startupErrors.some((l) => l === "error: duplicate registration: shapes/rect"),
    editor.startupErrors.join("\n")
  );
});

test("清单不一致：整批暂存注册被撤销，不留半装状态", () => {
  const { editor } = makeEditor([]);
  const partial = {
    name: "@test/partial",
    contributes: { commands: ["a", "b"] },
    activate(ctx) {
      ctx.registerCommand("a", () => ({ run: () => ["a"] }));
      ctx.registerDecorator("stale", () => ({ name: "stale", decorate: () => null }));
    },
  };
  assert.strictEqual(editor.host.activate(partial), false);
  assert.strictEqual(editor.ctx.commands.has("a"), false, "已注册的命令必须被撤销");
  assert.deepStrictEqual(editor.ctx.decorators.names(), [], "未声明的装饰器必须被撤销");
});

test("activate 抛错：已暂存注册全部撤销", () => {
  const { editor } = makeEditor([]);
  const bad = {
    name: "@test/half",
    contributes: { commands: ["x"] },
    activate(ctx) {
      ctx.registerCommand("x", () => ({ run: () => ["x"] }));
      throw new Error("stop");
    },
  };
  assert.strictEqual(editor.host.activate(bad), false);
  assert.strictEqual(editor.ctx.commands.has("x"), false);
  assert.ok(editor.startupErrors.some((l) => l.includes("failed to activate: @test/half (stop)")));
});

test("失败插件不影响后续插件装载", async () => {
  const { editor, file } = editorWithConfig({
    plugins: [
      { module: "./throws-on-activate.js" },
      { module: "./code-plugin.js" },
    ],
  });
  await loadFromConfig(editor, file);
  assert.ok(editor.ctx.commands.has("greet"));
});

// ---------- 缺省行为 ----------

test("禁用所有插件：内核能启动，只是没有任何命令", () => {
  const { editor } = makeEditor([]);
  assert.deepStrictEqual(editor.ctx.commands.helpLines(), []);
  assert.throws(() => editor.ctx.commands.dispatch(editor.ctx, "init", []), /unknown command: init/);
});

test("只装内置插件：help 逐字节等于 Phase 1 文案", () => {
  const { editor } = makeEditor([{ plugin: builtin }]);
  const lines = editor.ctx.commands.helpLines();
  assert.ok(lines.includes("  create <type> <id> [params…] [in <gid>]   types: rect circle ellipse line text g"));
  assert.strictEqual(lines[lines.length - 1], "  exit                                      quit");
  assert.ok(!lines.some((l) => l.includes("stats") || l.includes("dir")));
});

test("统计命令与目录命令未装载时报未知命令", () => {
  const { run } = makeEditor([{ plugin: builtin }]);
  assert.deepStrictEqual(run("stats"), ["error: unknown command: stats"]);
  assert.deepStrictEqual(run("dir"), ["error: unknown command: dir"]);
});
