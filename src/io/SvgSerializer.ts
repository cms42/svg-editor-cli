import { fmt } from "../model/Format";
import { Group } from "../model/Group";
import { Shape } from "../model/Shape";
import { SvgDocument } from "../model/SvgDocument";

/** 把文档序列化为合法 SVG XML（2 空格缩进，属性顺序 id→几何→样式）。 */
export class SvgSerializer {
  serialize(doc: SvgDocument): string {
    const lines: string[] = [];
    lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    const w = fmt(doc.width);
    const h = fmt(doc.height);
    lines.push(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    );
    for (const child of doc.root.children) this.writeShape(child, 1, lines);
    lines.push(`</svg>`);
    return lines.join("\n") + "\n";
  }

  private writeShape(shape: Shape, depth: number, lines: string[]): void {
    const indent = "  ".repeat(depth);
    const attrs = shape
      .serializeAttrs()
      .map(([k, v]) => `${k}="${escapeXml(v)}"`)
      .join(" ");
    const open = `${indent}<${shape.tag} ${attrs}`;
    const text = shape.textContent();
    if (shape instanceof Group) {
      if (shape.children.length === 0) {
        lines.push(`${open}/>`);
        return;
      }
      lines.push(`${open}>`);
      for (const c of shape.children) this.writeShape(c, depth + 1, lines);
      lines.push(`${indent}</${shape.tag}>`);
    } else if (text !== null) {
      lines.push(`${open}>${escapeXml(text)}</${shape.tag}>`);
    } else {
      lines.push(`${open}/>`);
    }
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
