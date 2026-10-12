/**
 * Command 模式核心接口：一条编辑命令 = 一个 undo 单元。
 * execute/undo 均返回要打印的回显行。
 */
export interface Command {
  execute(): string[];
  undo(): string[];
}

/** 非编辑类命令（文档类 / 显示类 / undo/redo 自身）：只运行，不进 undo 栈。 */
export interface Action {
  run(): string[];
}

export function isCommand(x: Command | Action): x is Command {
  return typeof (x as Command).execute === "function";
}

export class CommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommandError";
  }
}
