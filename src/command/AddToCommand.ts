import { Group } from "../model/Group";
import { Shape } from "../model/Shape";
import { Command, CommandError } from "./Command";
import { EditorContext } from "./EditorContext";

/** addto <gid> <id>：把已有图形移入容器（作为最后一个子节点）。 */
export class AddToCommand implements Command {
  private readonly ctx: EditorContext;
  private readonly group: Group;
  private readonly shape: Shape;
  private parent: Group | null = null;
  private index = 0;

  constructor(ctx: EditorContext, args: string[]) {
    this.ctx = ctx;
    if (args.length !== 2) throw new CommandError("usage: addto <gid> <id>");
    const doc = ctx.requireDoc();
    const g = doc.find(args[0]);
    if (!g.isContainer())
      throw new CommandError(`not a container: ${args[0]}`);
    const shape = doc.find(args[1]);
    if (shape === g)
      throw new CommandError(`cannot group a container into its own descendant: ${g.id}`);
    // 容器不能移入自己的子孙
    let p: Group | null = g.parent;
    while (p) {
      if (p === shape)
        throw new CommandError(
          `cannot group a container into its own descendant: ${shape.id}`
        );
      p = p.parent;
    }
    this.group = g as Group;
    this.shape = shape;
  }

  execute(): string[] {
    const doc = this.ctx.requireDoc();
    const { parent, index } = doc.detach(this.shape);
    this.parent = parent;
    this.index = index;
    doc.attach(this.shape, this.group);
    return [`${this.shape.label} moved into ${this.group.label}`];
  }

  undo(): string[] {
    const doc = this.ctx.requireDoc();
    doc.detach(this.shape);
    if (this.parent) doc.attach(this.shape, this.parent, this.index);
    return [
      `${this.shape.label} restored into ${doc.parentLabel(this.shape)}`,
    ];
  }
}
