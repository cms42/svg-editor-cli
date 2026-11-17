import type { Group } from "../../kernel/model/Group";
import type { Shape } from "../../kernel/model/Shape";
import { Command, CommandError } from "../../kernel/api/Command";
import type { EditorContext } from "../../kernel/core/EditorContext";

/** delete <id>：容器连同全部子孙一起删除，一个 undo 单元。 */
export class DeleteCommand implements Command {
  private readonly ctx: EditorContext;
  private readonly shape: Shape;
  private parent: Group | null = null;
  private index = 0;

  constructor(ctx: EditorContext, args: string[]) {
    this.ctx = ctx;
    if (args.length !== 1) throw new CommandError("usage: delete <id>");
    this.shape = ctx.requireDoc().find(args[0]);
    // 插件拥有的内部结构不可单独删除（如 box 的必要子部件）
    if (this.shape.parent !== null) {
      const veto = this.shape.detachVeto();
      if (veto) throw new CommandError(veto);
    }
  }

  execute(): string[] {
    const doc = this.ctx.requireDoc();
    const { parent, index } = doc.detach(this.shape);
    this.parent = parent;
    this.index = index;
    return [`${this.shape.label} deleted`];
  }

  undo(): string[] {
    const doc = this.ctx.requireDoc();
    if (this.parent) doc.attach(this.shape, this.parent, this.index);
    return [
      `${this.shape.label} restored into ${this.parent ? doc.parentLabel(this.shape) : "svg"}`,
    ];
  }
}
