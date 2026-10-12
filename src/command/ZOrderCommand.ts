import { Group } from "../model/Group";
import { Shape } from "../model/Shape";
import { Command, CommandError } from "./Command";
import { EditorContext } from "./EditorContext";

/** front <id> / back <id>：同级 z-order 调到最前/最后。 */
export class ZOrderCommand implements Command {
  private readonly ctx: EditorContext;
  private readonly shape: Shape;
  private readonly toFront: boolean;
  private parent: Group | null = null;
  private index = 0;

  constructor(ctx: EditorContext, args: string[], toFront: boolean) {
    this.ctx = ctx;
    if (args.length !== 1)
      throw new CommandError(`usage: ${toFront ? "front" : "back"} <id>`);
    this.shape = ctx.requireDoc().find(args[0]);
    this.toFront = toFront;
  }

  execute(): string[] {
    const parent = this.shape.parent;
    if (!parent) throw new CommandError(`no such shape: ${this.shape.id}`);
    this.parent = parent;
    this.index = parent.childIndex(this.shape);
    parent.removeChild(this.shape);
    if (this.toFront) parent.addChild(this.shape);
    else parent.insertChild(0, this.shape);
    return [`${this.shape.label} moved to ${this.toFront ? "front" : "back"}`];
  }

  undo(): string[] {
    if (this.parent) {
      this.parent.removeChild(this.shape);
      this.parent.insertChild(this.index, this.shape);
    }
    return [`${this.shape.label} z-order restored`];
  }
}
