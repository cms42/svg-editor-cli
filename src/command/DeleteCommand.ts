import { Group } from "../model/Group";
import { Shape } from "../model/Shape";
import { Command, CommandError } from "./Command";
import { EditorContext } from "./EditorContext";

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
