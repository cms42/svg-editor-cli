// SVG 大纲解析的单元测试：嵌套分组、无 id、编辑更新、不完整 XML。
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

const { buildOutline } = require(path.join(__dirname, "..", "out", "outline.js"));

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">
  <g id="flow">
    <rect id="start" x="30" y="70" width="120" height="60"/>
    <line id="edge" x1="150" y1="100" x2="250" y2="100"/>
    <rect id="end" x="250" y="70" width="120" height="60"/>
  </g>
  <text x="10" y="190">no id here</text>
</svg>`;

function labels(nodes) {
  return nodes.map((n) => n.label);
}

test("根元素与嵌套分组层级", () => {
  const { nodes, incomplete } = buildOutline(SAMPLE);
  assert.strictEqual(incomplete, false);
  assert.deepStrictEqual(labels(nodes), ["svg"]);
  const g = nodes[0].children[0];
  assert.strictEqual(g.label, "g#flow");
  assert.deepStrictEqual(labels(g.children), ["rect#start", "line#edge", "rect#end"]);
});

test("无 id 元素只显示标签名", () => {
  const { nodes } = buildOutline(SAMPLE);
  const text = nodes[0].children[1];
  assert.strictEqual(text.label, "text");
  assert.strictEqual(text.id, null);
});

test("偏移量指向起始标签（点击定位用）", () => {
  const { nodes } = buildOutline(SAMPLE);
  const start = nodes[0].children[0].children[0];
  assert.strictEqual(SAMPLE.slice(start.offset, start.offset + 16), '<rect id="start"');
});

test("自闭合与空容器", () => {
  const { nodes } = buildOutline('<svg><g id="a"/><g id="b"></g></svg>');
  assert.deepStrictEqual(labels(nodes[0].children), ["g#a", "g#b"]);
  assert.deepStrictEqual(nodes[0].children[1].children, []);
});

test("注释、<?xml?> 与 DOCTYPE 被跳过", () => {
  const src = `<?xml version="1.0"?>
<!DOCTYPE svg>
<svg><!-- a comment with <rect id="nope"/> --><circle id="c1" cx="1" cy="1" r="1"/></svg>`;
  const { nodes } = buildOutline(src);
  assert.deepStrictEqual(labels(nodes[0].children), ["circle#c1"]);
});

test("属性值中的 < 与 > 不干扰解析", () => {
  const src = '<svg><text id="t" data-x="a<b">x</text></svg>';
  const { nodes } = buildOutline(src);
  assert.deepStrictEqual(labels(nodes[0].children), ["text#t"]);
});

test("单引号属性值同样识别 id", () => {
  const { nodes } = buildOutline("<svg><rect id='r1' x='0'/></svg>");
  assert.strictEqual(nodes[0].children[0].label, "rect#r1");
});

// ---------- 编辑中的不完整输入 ----------

test("不完整：缺少闭合标签 → incomplete 且大纲为空", () => {
  const r = buildOutline('<svg><g id="a"><rect id="r1" x="0"');
  assert.strictEqual(r.incomplete, true);
  assert.deepStrictEqual(r.nodes, []);
});

test("不完整：未闭合的引号", () => {
  const r = buildOutline('<svg><rect id="r1');
  assert.strictEqual(r.incomplete, true);
});

test("不完整：只有开尖括号", () => {
  assert.strictEqual(buildOutline("<svg><").incomplete, true);
  assert.strictEqual(buildOutline("<").incomplete, true);
});

test("不完整：闭合标签不匹配", () => {
  assert.strictEqual(buildOutline('<svg><g id="a"></rect></svg>').incomplete, true);
});

test("空文本：完整但无节点", () => {
  const r = buildOutline("");
  assert.strictEqual(r.incomplete, false);
  assert.deepStrictEqual(r.nodes, []);
});

test("编辑过程中不会抛错（随机后缀截断）", () => {
  for (let i = 0; i <= SAMPLE.length; i++) {
    assert.doesNotThrow(() => buildOutline(SAMPLE.slice(0, i)), `prefix length ${i}`);
  }
});

test("编辑更新：改 id 后大纲随之变化", () => {
  const before = buildOutline('<svg><rect id="a"/></svg>');
  const after = buildOutline('<svg><rect id="b"/></svg>');
  assert.strictEqual(before.nodes[0].children[0].label, "rect#a");
  assert.strictEqual(after.nodes[0].children[0].label, "rect#b");
});

test("编辑更新：新增元素后大纲出现新节点", () => {
  const a = buildOutline('<svg><g id="g1"></g></svg>');
  const b = buildOutline('<svg><g id="g1"><circle id="c1"/></g></svg>');
  assert.deepStrictEqual(a.nodes[0].children[0].children, []);
  assert.deepStrictEqual(labels(b.nodes[0].children[0].children), ["circle#c1"]);
});

test("深层嵌套（10 层）不丢失层级", () => {
  let src = "<svg>";
  for (let i = 0; i < 10; i++) src += `<g id="g${i}">`;
  src += '<rect id="leaf"/>';
  for (let i = 0; i < 10; i++) src += "</g>";
  src += "</svg>";
  let node = buildOutline(src).nodes[0];
  for (let i = 0; i < 10; i++) {
    assert.strictEqual(node.children[0].label, `g#g${i}`);
    node = node.children[0];
  }
  assert.strictEqual(node.children[0].label, "rect#leaf");
});

test("非 svg 根元素也能解析（不强制 SVG 规范）", () => {
  const { nodes } = buildOutline('<html><body id="b"/></html>');
  assert.strictEqual(nodes[0].label, "html");
  assert.strictEqual(nodes[0].children[0].label, "body#b");
});
