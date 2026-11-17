import { Action } from "../../../kernel/api/Command";
import type { EditorContext } from "../../../kernel/core/EditorContext";

/**
 * help：命令清单**完全由注册表拼出**。
 * 每条命令的 help 文案随命令一起由插件注册，因此新增插件命令后 help 自动更新，
 * 内核这个动作不需要任何改动。
 */
export class HelpAction implements Action {
  constructor(private readonly ctx: EditorContext) {}

  run(): string[] {
    return this.ctx.commands.helpLines();
  }
}
