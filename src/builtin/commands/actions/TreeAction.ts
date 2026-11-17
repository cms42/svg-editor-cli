import { Group } from "../../../kernel/model/Group";
import type { Shape } from "../../../kernel/model/Shape";
import type { SvgDocument } from "../../../kernel/model/SvgDocument";
import type { TreeDecorator } from "../../../kernel/api/TreeDecorator";
import { Action, CommandError } from "../../../kernel/api/Command";
import type { EditorContext } from "../../../kernel/core/EditorContext";

/**
 * tree [id]：结构树，内联关键几何属性。
 * 对齐规则：属性列起点 = max(前缀宽 + 标签宽)（仅统计有属性的节点）+ 2 个空格，
 * 全树统一一列（与任务书 §6 示例一致）。
 *
 * 行尾标签（扩展点 3）由注册的 decorator 按注册顺序用单个空格拼接；
 * 没有注册任何 decorator 时输出与 Phase 1 逐字节相同。
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
    const decorators = this.ctx.decorators.all();
    if (this.args.length === 0) return renderTree(doc, decorators);
    const shape = doc.find(this.args[0]);
    return renderSubtree(doc, shape, decorators);
  }
}

interface Row {
  prefix: string;
  label: string;
  attrs: string;
  tags: string[];
}

function rootTags(doc: SvgDocument, decorators: readonly TreeDecorator[]): string[] {
  return collectTags(decorators, { kind: "root", shape: null, doc });
}

function collectTags(
  decorators: readonly TreeDecorator[],
  row: Parameters<TreeDecorator["decorate"]>[0]
): string[] {
  const tags: string[] = [];
  for (const d of decorators) {
    const t = d.decorate(row);
    if (t !== null && t !== "") tags.push(t);
  }
  return tags;
}

function renderTree(doc: SvgDocument, decorators: readonly TreeDecorator[]): string[] {
  const rows: Row[] = [];
  collectChildren(doc.root, "", rows, decorators, doc);
  const head = `svg (${doc.width}x${doc.height})`;
  return [joinTags(head, rootTags(doc, decorators)), ...formatRows(rows)];
}

function renderSubtree(
  doc: SvgDocument,
  shape: Shape,
  decorators: readonly TreeDecorator[]
): string[] {
  const rows: Row[] = [];
  if (shape instanceof Group) collectChildren(shape, "", rows, decorators, doc);
  const self: Row = {
    prefix: "",
    label: shape.label,
    attrs: shape.treeAttrs(),
    tags: collectTags(decorators, { kind: "shape", shape, doc }),
  };
  return formatRows([self, ...rows]);
}

function collectChildren(
  group: Group,
  prefix: string,
  rows: Row[],
  decorators: readonly TreeDecorator[],
  doc: SvgDocument
): void {
  const children = group.children;
  children.forEach((child, i) => {
    const last = i === children.length - 1;
    const p = prefix + (last ? "└── " : "├── ");
    rows.push({
      prefix: p,
      label: child.label,
      attrs: child.treeAttrs(),
      tags: collectTags(decorators, { kind: "shape", shape: child, doc }),
    });
    if (child instanceof Group) {
      collectChildren(child, prefix + (last ? "    " : "│   "), rows, decorators, doc);
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
    let line: string;
    if (!r.attrs) line = r.prefix + r.label;
    else {
      const pad = " ".repeat(Math.max(1, col - (r.prefix.length + r.label.length)));
      line = r.prefix + r.label + pad + r.attrs;
    }
    return joinTags(line, r.tags);
  });
}

function joinTags(line: string, tags: readonly string[]): string {
  return tags.length === 0 ? line : `${line} ${tags.join(" ")}`;
}
