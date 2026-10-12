import { Command, CommandError } from "./Command";

/**
 * undo/redo 栈。文档类命令（init/read/save/canvas 改尺寸）执行后
 * 调用 block()：清空两栈并禁止 undo/redo，直到下一条编辑命令解禁。
 * undo/redo 均为 peek-then-pop：执行失败时保留栈单元，不吞命令。
 */
export class History {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private blocked = false;

  /** 执行一条编辑命令：成功后入栈；新编辑清空 redo 栈并解禁。 */
  execute(cmd: Command): string[] {
    const out = cmd.execute();
    this.undoStack.push(cmd);
    this.redoStack = [];
    this.blocked = false;
    return out;
  }

  /** 文档类命令执行后调用。 */
  block(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.blocked = true;
  }

  undo(): string[] {
    if (this.blocked)
      throw new CommandError("undo not allowed after io command");
    const cmd = this.undoStack[this.undoStack.length - 1];
    if (!cmd) throw new CommandError("nothing to undo");
    const out = cmd.undo();
    this.undoStack.pop();
    this.redoStack.push(cmd);
    return out;
  }

  redo(): string[] {
    if (this.blocked)
      throw new CommandError("redo not allowed after io command");
    const cmd = this.redoStack[this.redoStack.length - 1];
    if (!cmd) throw new CommandError("nothing to redo");
    const out = cmd.execute();
    this.redoStack.pop();
    this.undoStack.push(cmd);
    return out;
  }
}
