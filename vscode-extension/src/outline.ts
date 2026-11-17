/**
 * SVG → 大纲节点的**纯函数**转换：不依赖 vscode 模块，因此可以直接用
 * node --test 做单元测试（嵌套分组、无 id、不完整 XML 等）。
 *
 * 只做「元素层级 + 标签名」这一件事，不做完整 SVG 校验：
 * 大纲是导航辅助，不是验证工具。
 */

export interface OutlineNode {
  /** 显示文本：有 id 时 `标签#id`，否则仅标签名。 */
  readonly label: string;
  readonly tag: string;
  readonly id: string | null;
  /** 该元素的起始标签在文本中的偏移，供点击定位。 */
  readonly offset: number;
  readonly children: OutlineNode[];
}

export interface OutlineResult {
  /** XML 不完整时为 true：此时 nodes 为空，大纲暂时清空而不是报错。 */
  readonly incomplete: boolean;
  readonly nodes: OutlineNode[];
}

const NAME = /^[A-Za-z_:][\w.:-]*/;
const ATTR = /([A-Za-z_:][\w.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/y;

/**
 * 解析 SVG 文本为大纲。
 *
 * 容错策略：遇到截断（缺少 `</g>`、未闭合引号、未闭合 `<`）就返回
 * `incomplete: true` 与空节点列表，让调用方"暂时清空大纲"，
 * 而不是让扩展抛错崩溃。
 */
export function buildOutline(source: string): OutlineResult {
  const root: OutlineNode = {
    label: "",
    tag: "#document",
    id: null,
    offset: 0,
    children: [],
  };
  const stack: OutlineNode[] = [root];
  let i = 0;
  const n = source.length;

  const incomplete = (): OutlineResult => ({ incomplete: true, nodes: [] });
  const push = (node: OutlineNode): void => {
    stack[stack.length - 1].children.push(node);
  };

  while (i < n) {
    const lt = source.indexOf("<", i);
    if (lt < 0) break;
    i = lt;

    if (source.startsWith("<!--", i)) {
      const end = source.indexOf("-->", i);
      if (end < 0) return incomplete();
      i = end + 3;
      continue;
    }
    if (source.startsWith("<?", i)) {
      const end = source.indexOf("?>", i);
      if (end < 0) return incomplete();
      i = end + 2;
      continue;
    }
    if (source.startsWith("<![CDATA[", i)) {
      const end = source.indexOf("]]>", i);
      if (end < 0) return incomplete();
      i = end + 3;
      continue;
    }
    if (source.startsWith("<!", i)) {
      // DOCTYPE 等：跳过整个声明（含内部子集）
      const end = source.indexOf(">", i);
      if (end < 0) return incomplete();
      i = end + 1;
      continue;
    }
    if (source.startsWith("</", i)) {
      const m = NAME.exec(source.slice(i + 2));
      if (!m) return incomplete();
      const close = source.indexOf(">", i);
      if (close < 0) return incomplete();
      // 只弹出与闭合标签同名的最近一层；不匹配就当作不完整
      const top = stack[stack.length - 1];
      if (top.tag !== m[0]) return incomplete();
      stack.pop();
      i = close + 1;
      continue;
    }

    // 起始标签
    const nameStart = i + 1;
    const m = NAME.exec(source.slice(nameStart));
    // `<` 之后还没有标签名 —— 正在输入中的半截标签，按不完整处理
    if (!m) return incomplete();
    const tag = m[0];
    let j = nameStart + tag.length;
    let id: string | null = null;
    let selfClosing = false;

    for (;;) {
      while (j < n && /\s/.test(source[j])) j++;
      if (j >= n) return incomplete();
      if (source[j] === "/" && source[j + 1] === ">") {
        selfClosing = true;
        j += 2;
        break;
      }
      if (source[j] === ">") {
        j++;
        break;
      }
      ATTR.lastIndex = j;
      const a = ATTR.exec(source);
      if (!a) {
        // 属性已开始但没闭合（正在输入中）
        return incomplete();
      }
      if (a[1] === "id") id = a[3] !== undefined ? a[3] : a[4];
      j = ATTR.lastIndex;
    }

    const node: OutlineNode = {
      label: id === null ? tag : `${tag}#${id}`,
      tag,
      id,
      offset: i,
      children: [],
    };
    push(node);
    if (!selfClosing) stack.push(node);
    i = j;
  }

  // 还有未闭合的元素 → 文本不完整
  if (stack.length !== 1) return incomplete();
  return { incomplete: false, nodes: root.children };
}

/** 大纲显示名：有 id 时 `标签#id`，否则仅标签名。 */
export function outlineLabel(tag: string, id: string | null): string {
  return id === null ? tag : `${tag}#${id}`;
}
