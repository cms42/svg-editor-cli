import { Group } from "../../model/Group";
import { Shape } from "../../model/Shape";
import { SvgDocument } from "../../model/SvgDocument";
import { Action, CommandError } from "../Command";
import { EditorContext } from "../EditorContext";

/**
 * tree [id]：结构树，内联关键几何属性。
 * 对齐规则：属性列起点 = max(前缀宽 + 标签宽)（仅统计有属性的节点）+ 2 个空格，
 * 全树统一一列（与任务书 §6 示例一致）。
 */
export class TreeAction implements Action {
  constructor(
    private readonly ctx: EditorContext,
    private readonly args: string[]
  ) {
    if (args.length > 1) throw new CommandError("usage: tree [id]");
  }

  run(): string[] {
    const doc = this.ctx.requireDoc();
    if (this.args.length === 0) return renderTree(doc);
    const shape = doc.find(this.args[0]);
    return renderSubtree(doc, shape);
  }
}

interface Row {
  prefix: string;
  label: string;
  attrs: string;
}

function renderTree(doc: SvgDocument): string[] {
  const rows: Row[] = [];
  collectChildren(doc.root, "", rows);
  return [`svg (${doc.width}x${doc.height})`, ...formatRows(rows)];
}

function renderSubtree(doc: SvgDocument, shape: Shape): string[] {
  void doc;
  const rows: Row[] = [];
  if (shape instanceof Group) collectChildren(shape, "", rows);
  return formatRows([
    { prefix: "", label: shape.label, attrs: shape.treeAttrs() },
    ...rows,
  ]);
}

function collectChildren(group: Group, prefix: string, rows: Row[]): void {
  const children = group.children;
  children.forEach((child, i) => {
    const last = i === children.length - 1;
    const p = prefix + (last ? "└── " : "├── ");
    rows.push({ prefix: p, label: child.label, attrs: child.treeAttrs() });
    if (child instanceof Group) {
      collectChildren(child, prefix + (last ? "    " : "│   "), rows);
    }
  });
}

function formatRows(rows: Row[]): string[] {
  let col = 0;
  for (const r of rows) {
    if (r.attrs) col = Math.max(col, r.prefix.length + r.label.length);
  }
  col += 2;
  return rows.map((r) => {
    if (!r.attrs) return r.prefix + r.label;
    const pad = " ".repeat(Math.max(1, col - (r.prefix.length + r.label.length)));
    return r.prefix + r.label + pad + r.attrs;
  });
}
