import { Group } from "../../kernel/model/Group";
import type { Shape } from "../../kernel/model/Shape";
import { Command, CommandError } from "../../kernel/api/Command";
import type { EditorContext } from "../../kernel/core/EditorContext";

/** ungroup <gid>：子图形提升到原容器的父级、占据原容器位置。 */
export class UngroupCommand implements Command {
  private readonly ctx: EditorContext;
  private readonly group: Group;
  private parent: Group | null = null;
  private index = 0;
  private children: Shape[] = [];

  constructor(ctx: EditorContext, args: string[]) {
    this.ctx = ctx;
    if (args.length !== 1) throw new CommandError("usage: ungroup <gid>");
    const doc = ctx.requireDoc();
    const target = doc.find(args[0]);
    if (!target.isContainer())
      throw new CommandError(`not a container: ${args[0]}`);
    // 复合图形的内部结构由插件所有，不得解散
    if (target.isComposite())
      throw new CommandError(`cannot ungroup composite shape: ${args[0]}`);
    if (doc.isTopLevel(target))
      throw new CommandError(`cannot ungroup top-level container: ${args[0]}`);
    this.group = target as Group;
  }

  execute(): string[] {
    const doc = this.ctx.requireDoc();
    const { parent, index } = doc.detach(this.group);
    this.parent = parent;
    this.index = index;
    this.children = [...this.group.children];
    let i = index;
    for (const c of this.children) {
      this.group.removeChild(c);
      doc.attach(c, parent, i++);
    }
    return [
      `g#${this.group.id} ungrouped, ${this.children.length} children promoted`,
    ];
  }

  undo(): string[] {
    const doc = this.ctx.requireDoc();
    for (const c of this.children) {
      doc.detach(c);
      doc.attach(c, this.group);
    }
    if (this.parent) doc.attach(this.group, this.parent, this.index);
    return [`g#${this.group.id} restored`];
  }
}
