module.exports = {
  name: "@test/code-plugin",
  contributes: { commands: ["greet"] },
  activate(ctx) {
    ctx.registerCommand("greet", () => ({ run: () => ["hello from plugin"] }), { section: "extra", line: "  greet  say hi" });
  },
};
