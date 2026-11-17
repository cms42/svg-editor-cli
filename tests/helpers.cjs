// 测试辅助：用最小的编辑器骨架 + 指定插件集合搭一个可驱动的会话。
// 只依赖内核公开接口，因此测试本身也验证了"插件可独立于宿主装配"。
const { createEditor } = require("../dist/assembly/Editor.js");

/**
 * @param {Array<{plugin: any, options?: object}>} plugins
 * @param {string} cwd
 */
function makeEditor(plugins, cwd = process.cwd()) {
  const editor = createEditor(cwd);
  for (const p of plugins) editor.host.activate(p.plugin, p.options ?? {});
  const { tokenize } = require("../dist/cli/tokenize.js");
  const { CommandError } = require("../dist/kernel/api/Command.js");
  const { ModelError } = require("../dist/kernel/model/Shape.js");

  /** 跑一行命令，返回输出行数组（错误也带 error: 前缀）。 */
  function run(line) {
    const tokens = tokenize(line);
    if (tokens.length === 0) return [];
    const [name, ...args] = tokens;
    try {
      return editor.ctx.commands.dispatch(editor.ctx, name, args);
    } catch (e) {
      if (e instanceof CommandError || e instanceof ModelError) return [`error: ${e.message}`];
      throw e;
    }
  }

  return {
    editor,
    ctx: editor.ctx,
    errors: editor.startupErrors,
    run,
    script(text) {
      const lines = [];
      for (const raw of text.split("\n")) {
        const line = raw.trim();
        if (line === "" || line.startsWith("#")) continue;
        lines.push(...run(line));
      }
      return lines;
    },
  };
}

module.exports = { makeEditor };
