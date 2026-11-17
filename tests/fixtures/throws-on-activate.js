module.exports = {
  name: "@test/throws",
  contributes: {},
  activate() { throw new Error("kaboom"); },
};
