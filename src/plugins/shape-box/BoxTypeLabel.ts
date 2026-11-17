import type { TreeDecorator } from "../../kernel/api/TreeDecorator";
import { BoxShape } from "./BoxShape";

/**
 * 扩展点 3 的插件实现：box 容器行追加类型标注 `(box)`。
 *
 * 只依赖 TreeRowView 提供的图形对象，不认识渲染器；
 * 渲染器也不知道本标签存在，因此新增标签时内核与渲染器差异为 0。
 */
export class BoxTypeLabel implements TreeDecorator {
  readonly name = "box-type-label";

  decorate(row: Parameters<TreeDecorator["decorate"]>[0]): string | null {
    if (row.kind === "root") return null;
    return row.shape instanceof BoxShape ? "(box)" : null;
  }
}

export default BoxTypeLabel;
