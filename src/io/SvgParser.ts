import { Group } from "../model/Group";
import { ShapeFactory, ShapeSpec } from "../model/ShapeFactory";
import { SvgDocument } from "../model/SvgDocument";
import { parseXml, XmlElement, XmlParseError } from "./XmlParser";

export interface ReadResult {
  doc: SvgDocument;
  warnings: string[];
}

/**
 * 把 SVG XML 文本读为文档（XML 子集即可）。
 * 缺 id 的元素按 `标签名+序号` 自动分配并产生警告。
 */
export class SvgParser {
  constructor(private readonly factory: ShapeFactory) {}

  parse(source: string): ReadResult {
    let root: XmlElement;
    try {
      root = parseXml(source);
    } catch (e) {
      if (e instanceof XmlParseError) throw new SvgReadError(e.message);
      throw e;
    }
    if (root.tag !== "svg") throw new SvgReadError("root element is not <svg>");
    const warnings: string[] = [];
    const width = parseDim(root.attrs.get("width"), 800);
    const height = parseDim(root.attrs.get("height"), 600);
    const doc = new SvgDocument(width, height);
    const counters = new Map<string, number>();
    const used = new Set<string>();

    const allocId = (tag: string): string => {
      const next = (counters.get(tag) ?? 0) + 1;
      counters.set(tag, next);
      return `${tag}${next}`;
    };

    const build = (el: XmlElement, parent: Group): void => {
      if (!this.factory.isRegistered(el.tag)) {
        warnings.push(`warning: ignoring unsupported element <${el.tag}>`);
        return;
      }
      let id = el.attrs.get("id") ?? null;
      if (id === null) {
        id = allocId(el.tag);
        warnings.push(`warning: assigned id ${id} to unnamed <${el.tag}>`);
      } else if (used.has(id)) {
        const fresh = allocId(el.tag);
        warnings.push(
          `warning: duplicate id ${id}, renamed to ${fresh} for <${el.tag}>`
        );
        id = fresh;
      }
      used.add(id);
      const spec: ShapeSpec = { attrs: el.attrs, text: el.text() };
      const shape = this.factory.create(el.tag, id, spec);
      doc.attach(shape, parent);
      if (shape instanceof Group) {
        for (const child of el.elements()) build(child, shape);
      }
    };

    for (const el of root.elements()) build(el, doc.root);
    return { doc, warnings };
  }
}

function parseDim(raw: string | undefined, dflt: number): number {
  if (raw === undefined) return dflt;
  const v = parseFloat(raw);
  return Number.isNaN(v) ? dflt : v;
}

export class SvgReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SvgReadError";
  }
}
