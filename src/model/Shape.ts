import { fmt } from "./Format";
import type { Group } from "./Group";

export type AttrPair = [string, string];

/**
 * 图形基类（Composite 中的 Component）。
 * 容器（Group）与叶子图形在 move/scale/set/delete 等操作上统一多态。
 */
export abstract class Shape {
  private _id: string;
  private _parent: Group | null = null;
  private _fill: string | null = null;
  private _stroke: string | null = null;
  private _strokeWidth: number | null = null;

  protected constructor(id: string) {
    this._id = id;
  }

  get id(): string {
    return this._id;
  }

  get parent(): Group | null {
    return this._parent;
  }

  /** 仅由 Group / SvgDocument 在挂载时调用。 */
  set parent(g: Group | null) {
    this._parent = g;
  }

  get fill(): string | null {
    return this._fill;
  }

  get stroke(): string | null {
    return this._stroke;
  }

  get strokeWidth(): number | null {
    return this._strokeWidth;
  }

  /** SVG 标签名，如 rect / circle / g。 */
  abstract get tag(): string;

  /** 树/show 中使用的定位标签，如 rect#r1。 */
  get label(): string {
    return `${this.tag}#${this.id}`;
  }

  isContainer(): boolean {
    return false;
  }

  /** 平移（增量）。容器整体平移。 */
  abstract move(dx: number, dy: number): void;

  /** 等比缩放：factor 同乘全部几何属性。容器递归到子孙。 */
  abstract scale(factor: number): void;

  /** 当前代表位置（move 回显用），无单一位置的图形返回 null。 */
  abstract position(): [number, number] | null;

  /** tree 内联属性，如 `x=0 y=0 w=800 h=600 fill=#ffffff`；g 返回空串。 */
  abstract treeAttrs(): string;

  /** show 的几何行（不含缩进），如 `cx=100 cy=100 r=20`。 */
  abstract geometryLine(): string;

  /** 序列化时的几何属性（顺序固定）。 */
  protected abstract geometryAttrPairs(): AttrPair[];

  /** 文本内容（仅 TextShape 非空）。 */
  textContent(): string | null {
    return null;
  }

  /** set 的几何属性白名单分派；返回 false 表示该属性不属于本类型。 */
  protected abstract setGeometry(attr: string, raw: string): boolean;

  /** set 几何属性后的回显值（默认原样字符串）。 */
  protected describeSet(attr: string, raw: string): string {
    return `${attr}=${raw}`;
  }

  /** 读取属性当前值（undo 记录旧值用）；不认识返回 null。 */
  get(attr: string): string | null {
    switch (attr) {
      case "fill":
        return this._fill;
      case "stroke":
        return this._stroke;
      case "stroke-width":
        return this._strokeWidth === null ? null : fmt(this._strokeWidth);
      default:
        return this.getGeometry(attr);
    }
  }

  protected abstract getGeometry(attr: string): string | null;

  /** 回显格式化（set/undo 共用）。 */
  describeValue(attr: string, raw: string): string {
    return this.describeSet(attr, raw);
  }

  /**
   * set 白名单入口：fill / stroke / stroke-width 公共，
   * 其余交给各几何类型；不认识则抛出 unknown attribute。
   */
  set(attr: string, raw: string): string {
    switch (attr) {
      case "fill":
        this._fill = raw;
        return `fill=${raw}`;
      case "stroke":
        this._stroke = raw;
        return `stroke=${raw}`;
      case "stroke-width": {
        const v = parseNumber(raw, attr);
        this._strokeWidth = v;
        return `stroke-width=${fmt(v)}`;
      }
      default:
        if (this.setGeometry(attr, raw)) return this.describeSet(attr, raw);
        throw new ModelError(`unknown attribute: ${attr}`);
    }
  }

  /** 序列化属性列表：id 在前，几何居中，样式居后。 */
  serializeAttrs(): AttrPair[] {
    const out: AttrPair[] = [["id", this._id], ...this.geometryAttrPairs()];
    if (this._fill !== null) out.push(["fill", this._fill]);
    if (this._stroke !== null) out.push(["stroke", this._stroke]);
    if (this._strokeWidth !== null)
      out.push(["stroke-width", fmt(this._strokeWidth)]);
    return out;
  }

  /** show 的样式行（无样式属性时为空串）。 */
  styleLine(): string {
    const parts: string[] = [];
    if (this._fill !== null) parts.push(`fill=${this._fill}`);
    if (this._stroke !== null) parts.push(`stroke=${this._stroke}`);
    if (this._strokeWidth !== null)
      parts.push(`stroke-width=${fmt(this._strokeWidth)}`);
    return parts.join(" ");
  }

  /** tree 内联属性中样式部分的通用拼装。 */
  protected withStyle(geo: string): string {
    const style = this.styleLine();
    return style ? `${geo} ${style}` : geo;
  }

  /** 读入外部文件时回填样式属性（不经过 set 白名单校验）。 */
  initStyle(fill: string | null, stroke: string | null, strokeWidth: string | null): void {
    if (fill !== null) this._fill = fill;
    if (stroke !== null) this._stroke = stroke;
    if (strokeWidth !== null) this._strokeWidth = parseFloat(strokeWidth);
  }
}

export class ModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelError";
  }
}

export function parseNumber(raw: string, what: string): number {
  const v = Number(raw);
  if (raw.trim() === "" || Number.isNaN(v)) {
    throw new ModelError(`invalid number for ${what}: ${raw}`);
  }
  return v;
}
