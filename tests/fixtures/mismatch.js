module.exports = {
  name: "@test/mismatch",
  contributes: { commands: ["foo", "bar"] },
  activate(ctx) { ctx.registerCommand("foo", () => ({ run: () => ["foo"] })); },
};
