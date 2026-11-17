import type { Shape } from "../model/Shape";

/**
 * 扩展点 4：某个属性在某图形上的领域语义。
 *
 * 内核 `set` 的流程（见 doc/README.md ADR-1）：
 *   1. 依次问已注册 handler `handles(shape, attr)`，先注册者优先；
 *   2. 命中则交给它执行，所有写入经 tx 记录，整条命令仍是一个 undo 单元；
 *   3. 都不命中则回落到默认白名单（Shape.set / Shape.unset）。
 */
export interface AttributeHandler {
  /** 注册名（contributes.attributes 声明的名字）。 */
  readonly name: string;

  /** 是否负责该图形 + 该属性；不得修改文档状态。 */
  handles(shape: Shape, attr: string): boolean;

  /**
   * 执行修改。所有写入必须经 tx（它记录旧值以支持 undo 与失败回滚）。
   * 返回两条**完整**回显行，由 handler 自己定义措辞。
   */
  apply(
    shape: Shape,
    attr: string,
    value: string,
    tx: AttributeTransaction
  ): AttributeOutcome;
}

export interface AttributeOutcome {
  /** execute 的回显行。 */
  readonly line: string;
  /** undo（回滚后）的回显行。 */
  readonly undoLine: string;
}

/** 一次 `set` 的事务日志。 */
export interface AttributeTransaction {
  /** 记录旧值并应用，返回 Shape.set 的描述串。 */
  set(shape: Shape, attr: string, value: string): string;
}
