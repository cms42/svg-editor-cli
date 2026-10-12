import { fmt, isNumericLiteral } from "../model/Format";
import { Shape } from "../model/Shape";
import { Command, CommandError } from "./Command";
import { EditorContext } from "./EditorContext";

/** move <id> <dx> <dy>：容器整体平移（Composite 统一操作）。 */
export class MoveCommand implements Command {
  private readonly shape: Shape;
  private readonly dx: number;
  private readonly dy: number;

  constructor(ctx: EditorContext, args: string[]) {
    if (args.length !== 3) throw new CommandError("usage: move <id> <dx> <dy>");
    this.shape = ctx.requireDoc().find(args[0]);
    this.dx = parseMoveNumber(args[1], "dx");
    this.dy = parseMoveNumber(args[2], "dy");
  }

  execute(): string[] {
    this.shape.move(this.dx, this.dy);
    return [this.message("moved")];
  }

  undo(): string[] {
    this.shape.move(-this.dx, -this.dy);
    return [this.message("moved back")];
  }

  private message(verb: string): string {
    const pos = this.shape.position();
    if (pos) {
      return `${this.shape.label} ${verb} to (${fmt(pos[0])},${fmt(pos[1])})`;
    }
    const dx = verb === "moved" ? this.dx : -this.dx;
    const dy = verb === "moved" ? this.dy : -this.dy;
    return `${this.shape.label} ${verb} by (${fmt(dx)},${fmt(dy)})`;
  }
}

export function parseMoveNumber(raw: string, what: string): number {
  if (!isNumericLiteral(raw))
    throw new CommandError(`invalid number for ${what}: ${raw}`);
  return Number(raw);
}
