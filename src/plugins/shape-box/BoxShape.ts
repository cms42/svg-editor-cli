import { Group } from "../../kernel/model/Group";
import { Rect } from "../../kernel/model/Rect";
import { TextShape } from "../../kernel/model/TextShape";

/** 标题相对框体的位置偏移（与 phase_cli_1.md §4.4 的示例一致）。 */
export const LABEL_DX = 20;
export const LABEL_DY = 35;

/** 子部件 id 派生规则，读回时也用它校验结构。 */
export function rectIdOf(id: string): string {
  return `${id}-rect`;
}

export function labelIdOf(id: string): string {
  return `${id}-label`;
}

/**
 * 复合图形 `box`：一个矩形 + 一个标题文字，整体又是一个容器。
 *
 * 内部结构（只在插件内维护）：
 *   g#n1 (box)
 *   ├── rect#n1-rect
 *   └── text#n1-label
 *
 * 子部件被 `lock()` 锁住，`delete` / `addto` / `group` 拿它们无效；
 * box 自身仍是普通容器，可以整体 move/scale/delete/group/in。
 */
export class BoxShape extends Group {
  constructor(id: string, rect: Rect, label: TextShape) {
    super(id);
    this.addChild(rect);
    this.addChild(label);
    // 子部件归插件所有：普通命令不得把它们单独摘走，否则 box 结构残缺
    rect.lock(`cannot detach required child of composite shape: ${rect.id}`);
    label.lock(`cannot detach required child of composite shape: ${label.id}`);
  }

  override get tag(): string {
    return "g";
  }

  /** 回显与统计里的类型名；SVG 标签名仍是 g。 */
  override get displayTag(): string {
    return "box";
  }

  override isComposite(): boolean {
    return true;
  }

  get boxRect(): Rect {
    return this.children[0] as Rect;
  }

  get boxLabel(): TextShape {
    return this.children[1] as TextShape;
  }
}
