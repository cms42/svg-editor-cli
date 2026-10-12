import { ModelError } from "../model/Shape";
import { CommandError } from "../command/Command";
import { CommandRegistry } from "../command/CommandRegistry";
import { EditorContext } from "../command/EditorContext";
import { tokenize, TokenizeError } from "./tokenize";

/**
 * REPL：提示符 `svg>`（仅交互终端显示），`#` 开头行为注释，
 * 错误统一 `error:` 前缀，命令失败不改变任何状态。
 */
export class Repl {
  private readonly ctx = new EditorContext();
  private readonly registry = CommandRegistry.builtin();
  private readonly out: (line: string) => void;

  constructor(out: (line: string) => void = (l) => console.log(l)) {
    this.out = out;
  }

  /** 处理一行输入；返回 false 表示退出。 */
  handleLine(raw: string): boolean {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) return true;
    let tokens: string[];
    try {
      tokens = tokenize(line);
    } catch (e) {
      if (e instanceof TokenizeError) {
        this.out(`error: ${e.message}`);
        return true;
      }
      throw e;
    }
    if (tokens.length === 0) return true;
    const [name, ...args] = tokens;
    if (name === "exit" || name === "quit") return false;
    try {
      const lines = this.registry.dispatch(this.ctx, name, args);
      for (const l of lines) this.out(l);
    } catch (e) {
      if (e instanceof CommandError || e instanceof ModelError) {
        this.out(`error: ${e.message}`);
      } else {
        throw e;
      }
    }
    return true;
  }
}
