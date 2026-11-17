/**
 * 迷你 XML 解析器（XML 子集）：
 * 支持元素、属性（单/双引号）、文本、自闭合、嵌套、注释、<?xml?> 声明。
 * 不追求完整 XML 规范（无 DTD/实体定义，仅 &amp; &lt; &gt; &quot; &apos; 预定义实体）。
 */

export class XmlElement {
  constructor(
    public tag: string,
    public attrs: Map<string, string>,
    public children: (XmlElement | string)[]
  ) {}

  /** 子元素（跳过文本节点）。 */
  elements(): XmlElement[] {
    return this.children.filter((c): c is XmlElement => c instanceof XmlElement);
  }

  /** 直接文本内容（拼接所有文本子节点，保留首尾空格以便 round-trip）。 */
  text(): string {
    return this.children
      .filter((c): c is string => typeof c === "string")
      .join("");
  }
}

export class XmlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XmlParseError";
  }
}

export function parseXml(input: string): XmlElement {
  let i = 0;
  const n = input.length;

  function fail(msg: string): never {
    throw new XmlParseError(`${msg} (at offset ${i})`);
  }

  function skipMisc(): void {
    for (;;) {
      while (i < n && /\s/.test(input[i])) i++;
      if (input.startsWith("<?", i)) {
        const end = input.indexOf("?>", i);
        if (end < 0) fail("unterminated <?...?>");
        i = end + 2;
      } else if (input.startsWith("<!--", i)) {
        const end = input.indexOf("-->", i);
        if (end < 0) fail("unterminated comment");
        i = end + 3;
      } else if (input.startsWith("<!", i)) {
        const end = input.indexOf(">", i);
        if (end < 0) fail("unterminated <!...>");
        i = end + 1;
      } else {
        return;
      }
    }
  }

  function parseName(): string {
    const m = /^[A-Za-z_][\w.:-]*/.exec(input.slice(i));
    if (!m) fail("expected name");
    i += m[0].length;
    return m[0];
  }

  function decode(s: string): string {
    return s
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
  }

  function parseElement(): XmlElement {
    if (input[i] !== "<") fail("expected <");
    i++;
    const tag = parseName();
    const attrs = new Map<string, string>();
    for (;;) {
      while (i < n && /\s/.test(input[i])) i++;
      if (input.startsWith("/>", i)) {
        i += 2;
        return new XmlElement(tag, attrs, []);
      }
      if (input[i] === ">") {
        i++;
        break;
      }
      const name = parseName();
      while (i < n && /\s/.test(input[i])) i++;
      if (input[i] !== "=") fail(`expected = after attribute ${name}`);
      i++;
      while (i < n && /\s/.test(input[i])) i++;
      const q = input[i];
      if (q !== '"' && q !== "'") fail("expected quoted attribute value");
      i++;
      const end = input.indexOf(q, i);
      if (end < 0) fail("unterminated attribute value");
      attrs.set(name, decode(input.slice(i, end)));
      i = end + 1;
    }
    const children: (XmlElement | string)[] = [];
    for (;;) {
      if (i >= n) fail(`unterminated <${tag}>`);
      if (input.startsWith("</", i)) {
        i += 2;
        const close = parseName();
        if (close !== tag) fail(`mismatched </${close}> for <${tag}>`);
        while (i < n && /\s/.test(input[i])) i++;
        if (input[i] !== ">") fail("expected >");
        i++;
        return new XmlElement(tag, attrs, children);
      }
      if (input.startsWith("<!--", i)) {
        const end = input.indexOf("-->", i);
        if (end < 0) fail("unterminated comment");
        i = end + 3;
        continue;
      }
      if (input[i] === "<") {
        children.push(parseElement());
      } else {
        const end = input.indexOf("<", i);
        if (end < 0) fail(`unterminated <${tag}>`);
        const raw = input.slice(i, end);
        if (raw.trim() !== "") children.push(decode(raw));
        i = end;
      }
    }
  }

  skipMisc();
  const root = parseElement();
  skipMisc();
  if (i < n) fail("trailing content after root element");
  return root;
}
