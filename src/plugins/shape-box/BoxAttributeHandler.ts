import type { Shape } from "../../kernel/model/Shape";
import type {
  AttributeHandler,
  AttributeOutcome,
  AttributeTransaction,
} from "../../kernel/api/AttributeHandler";
import { BoxShape } from "./BoxShape";

/**
 * 扩展点 4 的插件实现：box 的属性领域语义。
 *
 * - `fill`  → 转发给内部矩形 `n1-rect`（沿用标准属性名，语义是"框体填充"）
 * - `label` → 改写内部文字 `n1-label`（插件新增的便利属性，不是 SVG 标准属性）
 *
 * 两条命令各自是一个 undo 单元：所有写入都经 tx 记录，
 * 由 SetCommand 统一回滚，因此一次 undo 能把 box 恢复原状。
 */
export class BoxAttributeHandler implements AttributeHandler {
  readonly name = "box-attributes";

  /** 本插件负责的属性；其余属性交回内核默认规则。 */
  private static readonly OWNED = new Set(["fill", "label"]);

  handles(shape: Shape, attr: string): boolean {
    return shape instanceof BoxShape && BoxAttributeHandler.OWNED.has(attr);
  }

  apply(
    shape: Shape,
    attr: string,
    value: string,
    tx: AttributeTransaction
  ): AttributeOutcome {
    const box = shape as BoxShape;
    if (attr === "fill") {
      const rect = box.boxRect;
      const before = rect.get("fill");
      tx.set(rect, "fill", value);
      return {
        line: `${box.typedLabel} fill propagated to ${rect.id}`,
        undoLine:
          before === null
            ? `${box.typedLabel} fill restored to (unset) on ${rect.id}`
            : `${box.typedLabel} fill restored to ${before} on ${rect.id}`,
      };
    }
    const text = box.boxLabel;
    const before = text.text;
    tx.set(text, "text", value);
    return {
      line: `${box.typedLabel} label updated: "${value}"`,
      undoLine: `${box.typedLabel} label restored: "${before}"`,
    };
  }
}

export default BoxAttributeHandler;
