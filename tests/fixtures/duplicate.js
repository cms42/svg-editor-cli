module.exports = {
  name: "@test/dup",
  contributes: { shapes: ["rect"] },
  activate(ctx) {
    ctx.registerShape({ type: "rect", usage: "u", parse: () => ({ attrs: new Map() }), create: () => null });
  },
};
