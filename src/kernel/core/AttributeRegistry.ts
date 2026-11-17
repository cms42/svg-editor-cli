import type { AttributeHandler, AttributeTransaction } from "../api/AttributeHandler";
import type { Shape } from "../model/Shape";

/**
 * 扩展点 4 的注册表：按注册顺序保存 handler，`find` 返回第一个命中者。
 * 冲突规则（见 doc/README.md 的 ADR-1）：先注册者优先，不做组合执行，
 * 因此"谁命中"始终可预测，不存在隐式覆盖。
 */
export class AttributeRegistry {
  private readonly handlers: AttributeHandler[] = [];

  register(handler: AttributeHandler): void {
    this.handlers.push(handler);
  }

  names(): string[] {
    return this.handlers.map((h) => h.name);
  }

  find(shape: Shape, attr: string): AttributeHandler | null {
    for (const h of this.handlers) {
      if (h.handles(shape, attr)) return h;
    }
    return null;
  }
}

interface JournalEntry {
  shape: Shape;
  attr: string;
  oldValue: string | null;
}

/**
 * 一条 `set` 命令的事务日志。
 * - 正常结束：History 把整条命令当作一个 undo 单元，undo 时 rollback。
 * - 中途抛错：SetCommand 立即 rollback，History 不入栈，历史保持原样。
 */
export class SetTransaction implements AttributeTransaction {
  private readonly journal: JournalEntry[] = [];

  set(shape: Shape, attr: string, value: string): string {
    this.journal.push({ shape, attr, oldValue: shape.get(attr) });
    return shape.set(attr, value);
  }

  get size(): number {
    return this.journal.length;
  }

  /** redo 重新执行前清空，避免旧记录被重复回滚。 */
  reset(): void {
    this.journal.length = 0;
  }

  /** 逆序还原所有已写入的属性（未设置过的还原为"未设置"）。 */
  rollback(): void {
    for (let i = this.journal.length - 1; i >= 0; i--) {
      const { shape, attr, oldValue } = this.journal[i];
      if (oldValue === null) shape.unset(attr);
      else shape.set(attr, oldValue);
    }
  }
}
