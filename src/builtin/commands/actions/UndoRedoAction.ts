import { Action } from "../../../kernel/api/Command";
import { EditorContext } from "../../../kernel/core/EditorContext";

/** undo / redo：委托给 History（不进 undo 栈自身）。 */
export class UndoAction implements Action {
  constructor(private readonly ctx: EditorContext) {}
  run(): string[] {
    return this.ctx.history.undo();
  }
}

export class RedoAction implements Action {
  constructor(private readonly ctx: EditorContext) {}
  run(): string[] {
    return this.ctx.history.redo();
  }
}
