import { SvgDocument } from "../../model/SvgDocument";
import { Action, CommandError } from "../Command";
import { EditorContext } from "../EditorContext";
import { parseMoveNumber } from "../MoveCommand";

/** init [w] [h]：新建空画布（默认 800×600）。文档类命令：执行后禁止 undo/redo。 */
export class InitAction implements Action {
  private readonly w: number;
  private readonly h: number;

  constructor(
    private readonly ctx: EditorContext,
    args: string[]
  ) {
    if (args.length !== 0 && args.length !== 2)
      throw new CommandError("usage: init [width] [height]");
    this.w = args.length === 2 ? parseMoveNumber(args[0], "width") : 800;
    this.h = args.length === 2 ? parseMoveNumber(args[1], "height") : 600;
    if (this.w <= 0 || this.h <= 0)
      throw new CommandError("canvas size must be positive");
  }

  run(): string[] {
    this.ctx.doc = new SvgDocument(this.w, this.h);
    this.ctx.history.block();
    return [`canvas ${this.w}x${this.h} created`];
  }
}
