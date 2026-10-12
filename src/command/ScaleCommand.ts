import { fmt } from "../model/Format";
import { Shape } from "../model/Shape";
import { Command, CommandError } from "./Command";
import { EditorContext } from "./EditorContext";
import { parseMoveNumber } from "./MoveCommand";

/** scale <id> <factor>：factor 同乘全部几何属性；容器递归到每个子孙。 */
export class ScaleCommand implements Command {
  private readonly shape: Shape;
  private readonly factor: number;

  constructor(ctx: EditorContext, args: string[]) {
    if (args.length !== 2) throw new CommandError("usage: scale <id> <factor>");
    this.shape = ctx.requireDoc().find(args[0]);
    this.factor = parseMoveNumber(args[1], "factor");
    if (this.factor <= 0)
      throw new CommandError("scale factor must be positive");
  }

  execute(): string[] {
    this.shape.scale(this.factor);
    return [`${this.shape.label} scaled by ${fmt(this.factor)}`];
  }

  undo(): string[] {
    this.shape.scale(1 / this.factor);
    return [`${this.shape.label} scale restored`];
  }
}
