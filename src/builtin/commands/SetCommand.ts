import { ModelError } from "../../kernel/model/Shape";
import { SetTransaction } from "../../kernel/core/AttributeRegistry";
import { Command, CommandError } from "../../kernel/api/Command";
import type { AttributeHandler } from "../../kernel/api/AttributeHandler";
import type { EditorContext } from "../../kernel/core/EditorContext";
import type { Shape } from "../../kernel/model/Shape";

/**
 * set <id> <attr> <value>
 *
 * 先问 AttributeRegistry（扩展点 4）；没有 handler 命中时才回落到
 * Phase 1 的白名单校验（Shape.set / Shape.unset）。
 *
 * 事务保证（见 doc/README.md ADR-1）：
 * - handler 的全部写入经同一个 SetTransaction 记录，
 *   因此改多个子部件也只对应**一个** undo 单元；
 * - handler 中途抛错 → 立即回滚已写入的属性并抛出，History 不入栈，
 *   文档与 undo/redo 历史都停在命令执行前；
 * - redo 重新执行 apply（而不是复用上次结果），保证文档真的被改回去。
 */
export class SetCommand implements Command {
  private readonly shape: Shape;
  private readonly attr: string;
  private readonly value: string;
  private readonly handler: AttributeHandler | null;
  private readonly tx = new SetTransaction();
  private oldValue: string | null = null;
  private handlerUndoLine = "";

  constructor(
    private readonly ctx: EditorContext,
    args: string[]
  ) {
    if (args.length !== 3) throw new CommandError("usage: set <id> <attr> <value>");
    this.shape = ctx.requireDoc().find(args[0]);
    this.attr = args[1];
    this.value = args[2];
    this.handler = ctx.attributes.find(this.shape, this.attr);
  }

  execute(): string[] {
    if (this.handler) {
      this.tx.reset();
      try {
        const out = this.handler.apply(this.shape, this.attr, this.value, this.tx);
        this.handlerUndoLine = out.undoLine;
        return [out.line];
      } catch (e) {
        // 部分修改后抛错：先把已写入的属性全部还原，再上报
        this.tx.rollback();
        throw asCommandError(e);
      }
    }
    this.oldValue = this.shape.get(this.attr);
    try {
      const desc = this.shape.set(this.attr, this.value);
      return [`${this.shape.label} updated: ${desc}`];
    } catch (e) {
      throw asCommandError(e);
    }
  }

  undo(): string[] {
    if (this.handler) {
      this.tx.rollback();
      return [this.handlerUndoLine];
    }
    if (this.oldValue === null) {
      // 旧值未设置：还原为"未设置"而非写回空串
      return [`${this.shape.label} updated: ${this.shape.unset(this.attr)}`];
    }
    this.shape.set(this.attr, this.oldValue);
    const desc = this.shape.describeValue(this.attr, this.oldValue);
    return [`${this.shape.label} updated: ${desc}`];
  }
}

function asCommandError(e: unknown): Error {
  if (e instanceof ModelError) return new CommandError(e.message);
  if (e instanceof CommandError) return e;
  return new CommandError(e instanceof Error ? e.message : String(e));
}
