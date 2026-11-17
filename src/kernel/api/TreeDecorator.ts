import type { SvgDocument } from "../model/SvgDocument";
import type { Shape } from "../model/Shape";

/** 渲染器交给标签的一行信息：根行与图形行。 */
export interface TreeRowView {
  readonly kind: "root" | "shape";
  /** 根行为 null。 */
  readonly shape: Shape | null;
  readonly doc: SvgDocument;
}

/**
 * 扩展点 3：结构树每行行尾的标签。
 *
 * 渲染器只负责"拼"：把每个标签的返回值按注册顺序用单个空格连接追加到行尾。
 * 标签自己维护的状态必须放在实例字段里（每个编辑器会话一套实例）。
 */
export interface TreeDecorator {
  readonly name: string;
  decorate(row: TreeRowView): string | null;
}

/** 每个编辑器会话实例化一次，便于标签把状态封装在实例字段中。 */
export type TreeDecoratorFactory = () => TreeDecorator;
