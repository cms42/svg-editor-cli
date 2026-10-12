import { Action, CommandError } from "../Command";
import { EditorContext } from "../EditorContext";
import { parseMoveNumber } from "../MoveCommand";

/** canvas [w] [h]：无参数显示画布尺寸；带参数修改尺寸（文档类，禁 undo/redo）。 */
export class CanvasAction implements Action {
  constructor(
    private readonly ctx: EditorContext,
    private readonly args: string[]
  ) {
    if (args.length !== 0 && args.length !== 2)
      throw new CommandError("usage: canvas [width] [height]");
  }

  run(): string[] {
    const doc = this.ctx.requireDoc();
    if (this.args.length === 0) {
      return [`canvas ${doc.width}x${doc.height}`];
    }
    const w = parseMoveNumber(this.args[0], "width");
    const h = parseMoveNumber(this.args[1], "height");
    doc.resize(w, h);
    this.ctx.history.block();
    return [`canvas resized to ${w}x${h}`];
  }
}
