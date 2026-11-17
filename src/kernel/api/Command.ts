/**
 * Command 模式核心接口：一条编辑命令 = 一个 undo 单元。
 * execute/undo 均返回要打印的回显行。
 *
 * 扩展点：命令插件通过 PluginContext.registerCommand 贡献 CommandFactory。
 * 内核只认识这里的接口，不认识任何具体命令名。
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

/** help 中一条命令的归属与文案，由注册该命令的插件提供。 */
export interface CommandHelp {
  /** help 的分节名，如 `edit (undoable)`。分节按首次出现顺序排列。 */
  section: string;
  /**
   * 分节内的一整行（含缩进），原样输出。
   * 可以是函数：渲染时求值，让内容随注册表变化（如已装载的图形类型）。
   */
  line: string | (() => string);
}
