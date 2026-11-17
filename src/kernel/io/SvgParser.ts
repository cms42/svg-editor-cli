import { Group } from "../model/Group";
import type { Shape } from "../model/Shape";
import { SvgDocument } from "../model/SvgDocument";
import { ShapeReadError } from "../api/ShapeProvider";
import type { ShapeNode } from "../api/ShapeProvider";
import type { ShapeRegistry } from "../core/ShapeRegistry";
import { parseXml, XmlElement, XmlParseError } from "./XmlParser";

export interface ReadResult {
  doc: SvgDocument;
  warnings: string[];
}

/**
 * 把 SVG XML 文本读为文档（XML 子集即可）。
 *
 * 元素归属由 ShapeRegistry 决定（扩展点 1），本类不认识任何具体图形类型：
 * - 有 provider 认领 → 交给它构造；`ownsChildren` 的 provider 自己吃整棵子树；
 * - 声明了未知 `data-kind` → 按标签名降级，并警告；
 * - 标签名也没有 provider → 忽略该元素并警告。
 *
 * 缺 id 的元素按 `标签名+序号` 自动分配并产生警告；显式重复 id 改名避让并警告
 * （Phase 1 行为）。复合图形派生的子部件 id 同样占用全局 id 空间，冲突即整份读入失败。
 */
export class SvgParser {
  constructor(private readonly shapes: ShapeRegistry) {}

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
    const doc = new SvgDocument(
      parseDim(root.attrs.get("width"), 800),
      parseDim(root.attrs.get("height"), 600)
    );
    const counters = new Map<string, number>();
    const used = new Set<string>();

    const allocId = (tag: string): string => {
      let next = counters.get(tag) ?? 0;
      let candidate: string;
      do {
        next++;
        candidate = `${tag}${next}`;
      } while (used.has(candidate));
      counters.set(tag, next);
      return candidate;
    };

    const claimId = (el: XmlElement): string => {
      const explicit = el.attrs.get("id") ?? null;
      if (explicit === null) {
        const id = allocId(el.tag);
        warnings.push(`warning: assigned id ${id} to unnamed <${el.tag}>`);
        used.add(id);
        return id;
      }
      if (used.has(explicit)) {
        const fresh = allocId(el.tag);
        warnings.push(
          `warning: duplicate id ${explicit}, renamed to ${fresh} for <${el.tag}>`
        );
        used.add(fresh);
        return fresh;
      }
      used.add(explicit);
      return explicit;
    };

    const build = (el: XmlElement, parent: Group): void => {
      const declaredKind = el.attrs.get("data-kind") ?? null;
      let provider = declaredKind !== null ? this.shapes.get(declaredKind) : undefined;
      if (declaredKind !== null && !provider) {
        warnings.push(
          `warning: unsupported kind ${declaredKind}, degraded <${el.tag}> to plain element`
        );
      }
      provider ??= this.shapes.providerForTag(el.tag);
      if (!provider) {
        warnings.push(`warning: ignoring unsupported element <${el.tag}>`);
        return;
      }

      const id = claimId(el);
      const node = toNode(el);
      const ctx = { isIdTaken: (candidate: string) => used.has(candidate) };

      let shape: Shape;
      try {
        if (provider.ownsChildren && provider.fromNode) {
          shape = provider.fromNode(node, id, ctx);
        } else {
          shape = provider.create(id, { attrs: el.attrs, text: el.text() }, ctx);
        }
      } catch (e) {
        throw new SvgReadError(explain(e));
      }

      if (!(provider.ownsChildren && provider.fromNode)) {
        shape.initStyle(
          el.attrs.get("fill") ?? null,
          el.attrs.get("stroke") ?? null,
          el.attrs.get("stroke-width") ?? null
        );
      }

      // 复合图形派生的子部件 id 也要占用全局 id 空间
      for (const part of subtree(shape)) {
        if (part.id === id) continue;
        if (used.has(part.id)) throw new SvgReadError(`duplicate id: ${part.id}`);
        used.add(part.id);
      }

      doc.attach(shape, parent);
      if (!(provider.ownsChildren && provider.fromNode) && shape.isContainer()) {
        for (const child of el.elements()) build(child, shape as Group);
      }
    };

    for (const el of root.elements()) build(el, doc.root);
    return { doc, warnings };
  }
}

function subtree(shape: Shape): Shape[] {
  return shape instanceof Group ? [...shape.walk()] : [shape];
}

function toNode(el: XmlElement): ShapeNode {
  return {
    tag: el.tag,
    attrs: el.attrs,
    text: el.text(),
    children: el.elements().map(toNode),
  };
}

function explain(e: unknown): string {
  if (e instanceof ShapeReadError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
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
