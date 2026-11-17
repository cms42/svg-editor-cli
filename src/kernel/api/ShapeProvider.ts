import type { Shape } from "../model/Shape";

/** 工厂拿到的是已解析的属性表与文本内容（CLI 与 SVG 解析器共用此入口）。 */
export interface ShapeSpec {
  attrs: ReadonlyMap<string, string>;
  text?: string;
}

/** 读回时交给 provider 的中立节点，不暴露内核 XML 类型。 */
export interface ShapeNode {
  readonly tag: string;
  readonly attrs: ReadonlyMap<string, string>;
  readonly text: string;
  readonly children: readonly ShapeNode[];
}

/** create/read 时提供给插件的上下文：只暴露"这个 id 是否已被占用"。 */
export interface ShapeCreateContext {
  isIdTaken(id: string): boolean;
}

/**
 * 扩展点 1：一种图形类型。
 *
 * 内核只按 `type` 名字索引 provider，不枚举具体类型；`create` 与 `read` 都走这里。
 * provider 可以生成任意 Shape 子树（复合图形即多挂几个子部件），内核不感知其内部结构。
 */
export interface ShapeProvider {
  /** 注册名，即 `create <type>` 的类型名，也是 `data-kind` 的取值。 */
  readonly type: string;
  /** create 的参数说明，用于 usage 报错与 help。 */
  readonly usage: string;

  /** 读回时可能遇到的元素标签名，缺省为 `[type]`。复合图形声明 `["g"]`。 */
  readonly readTags?: readonly string[];

  /**
   * 为 true 表示 provider 自己负责整棵子树（含子部件），解析器不再下钻 XML。
   * 这类 provider 必须实现 `fromNode`。
   */
  readonly ownsChildren?: boolean;

  /** 把 CLI 参数解析为 ShapeSpec；参数不对抛 ModelError。 */
  parse(args: string[]): ShapeSpec;

  /**
   * 构造图形（只在首次 execute 时调用一次）。
   * 复合图形在这里检查自己派生出的 id 是否已被占用，冲突时抛 ModelError。
   */
  create(id: string, spec: ShapeSpec, ctx: ShapeCreateContext): Shape;

  /**
   * 读回：由本 provider 接管整个元素（含子部件）。
   * 结构不合法时抛 ShapeReadError，整份读入失败、原文档保持不变。
   */
  fromNode?(node: ShapeNode, id: string, ctx: ShapeCreateContext): Shape;
}

/** 读入失败（整份文件拒绝载入，原文档保持不变）。 */
export class ShapeReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShapeReadError";
  }
}
