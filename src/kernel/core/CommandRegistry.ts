import { CommandError, isCommand } from "../api/Command";
import type { Action, Command, CommandHelp } from "../api/Command";
import type { CommandFactory } from "../api/Plugin";
import type { EditorContext } from "./EditorContext";

interface Registration {
  name: string;
  factory: CommandFactory;
  helpLines: string[];
}

interface Section {
  section: string;
  entries: { key: string; render: () => string }[];
}

/**
 * 扩展点 2 的注册表 + 命令分发点。
 * 命令名、参数规则与 help 文案都由注册它的插件提供，内核不持有命令清单。
 */
export class CommandRegistry {
  private readonly handlers = new Map<string, Registration>();
  private readonly sections: Section[] = [];

  register(name: string, factory: CommandFactory, help?: CommandHelp): void {
    this.handlers.set(name, { name, factory, helpLines: [] });
    if (help) this.addHelpLine(help.section, help.line);
  }

  /** 只贡献 help 行（如 Repl 自处理的 exit）。同一节内去重。 */
  addHelpLine(section: string, line: string | (() => string)): void {
    let entry = this.sections.find((s) => s.section === section);
    if (!entry) {
      entry = { section, entries: [] };
      this.sections.push(entry);
    }
    const render = typeof line === "function" ? line : () => line;
    const key = typeof line === "function" ? `\u0000fn:${entry.entries.length}` : line;
    if (entry.entries.some((e) => e.key === key)) return;
    entry.entries.push({ key, render });
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  names(): string[] {
    return [...this.handlers.keys()];
  }

  /** help 的完整输出行：按分节首次出现顺序，节内按注册顺序。 */
  helpLines(): string[] {
    const out: string[] = [];
    for (const s of this.sections) {
      out.push(`${s.section}:`);
      for (const e of s.entries) out.push(e.render());
    }
    return out;
  }

  dispatch(ctx: EditorContext, name: string, args: string[]): string[] {
    const reg = this.handlers.get(name);
    if (!reg) throw new CommandError(`unknown command: ${name}`);
    const unit = reg.factory(ctx, args);
    if (isUndoable(unit)) {
      const out = ctx.history.execute(unit);
      ctx.events.emit("document-edited");
      return out;
    }
    return unit.run();
  }
}

function isUndoable(x: Command | Action): x is Command {
  return isCommand(x);
}
