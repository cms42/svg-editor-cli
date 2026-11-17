import { Group } from "../../kernel/model/Group";
import type { Shape } from "../../kernel/model/Shape";
import { Action } from "../../kernel/api/Command";
import type { PluginModule } from "../../kernel/api/Plugin";
import type { EditorContext } from "../../kernel/core/EditorContext";

/**
 * `stats`：按当前子节点顺序深度优先统计叶子图形。
 *
 * 叶子按类型计数，类型顺序按首次出现顺序；普通 g 与复合容器只计入
 * containers，根 svg 不计入。只读，不进 undo 栈。
 */
export class StatsAction implements Action {
  constructor(private readonly ctx: EditorContext) {}

  run(): string[] {
    const doc = this.ctx.doc;
    if (!doc) return ["(total 0, containers 0)"];
    const counts: { type: string; n: number }[] = [];
    let containers = 0;
    let total = 0;

    const visit = (shape: Shape): void => {
      if (shape.isContainer()) {
        containers++;
        for (const child of (shape as Group).children) visit(child);
        return;
      }
      total++;
      const type = shape.displayTag;
      const hit = counts.find((c) => c.type === type);
      if (hit) hit.n++;
      else counts.push({ type, n: 1 });
    };

    for (const child of doc.root.children) visit(child);

    const parts = counts.map((c) => `${c.type}: ${c.n}`);
    parts.push(tokenSummary(total, containers));
    return [parts.join("  ")];
  }
}

/** 空文档时只有汇总段，形如 `(total 0, containers 0)`。 */
function tokenSummary(total: number, containers: number): string {
  return `(total ${total}, containers ${containers})`;
}

const plugin: PluginModule = {
  name: "@svgframe/plugin-stats",
  contributes: { commands: ["stats"] },
  activate(ctx) {
    ctx.registerCommand("stats", (c) => new StatsAction(c), {
      section: "display",
      line: "  stats                                     count leaf shapes by type",
    });
  },
};

export default plugin;
