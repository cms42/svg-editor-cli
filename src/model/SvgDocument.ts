import { Group } from "./Group";
import { ModelError, Shape } from "./Shape";

/**
 * 当前文档：画布尺寸 + 根容器 + id 索引。
 * 所有命令一律通过 id 定位图形，唯一性在此强制。
 */
export class SvgDocument {
  private _width: number;
  private _height: number;
  private readonly _root: Group;
  private readonly _index = new Map<string, Shape>();

  constructor(width: number, height: number) {
    this._width = width;
    this._height = height;
    this._root = new Group("svg");
  }

  get width(): number {
    return this._width;
  }
  get height(): number {
    return this._height;
  }

  get root(): Group {
    return this._root;
  }

  /** 读入时的来源路径（save 无参数时使用）。 */
  sourcePath: string | null = null;

  resize(w: number, h: number): void {
    this._width = w;
    this._height = h;
  }

  has(id: string): boolean {
    return this._index.has(id);
  }

  find(id: string): Shape {
    const s = this._index.get(id);
    if (!s) throw new ModelError(`no such shape: ${id}`);
    return s;
  }

  /** 挂载子树并注册全部 id（含子孙）。 */
  attach(shape: Shape, parent: Group, index?: number): void {
    this.register(shape);
    if (index === undefined) parent.addChild(shape);
    else parent.insertChild(index, shape);
  }

  /** 摘下子树并注销全部 id（含子孙）。 */
  detach(shape: Shape): { parent: Group; index: number } {
    const parent = shape.parent;
    if (!parent) throw new ModelError(`no such shape: ${shape.id}`);
    const index = parent.childIndex(shape);
    parent.removeChild(shape);
    this.unregister(shape);
    return { parent, index };
  }

  private register(shape: Shape): void {
    const ids = shape instanceof Group ? shape.walk() : [shape];
    for (const s of ids) {
      if (this._index.has(s.id))
        throw new ModelError(`id already exists: ${s.id}`);
    }
    for (const s of ids) this._index.set(s.id, s);
  }

  private unregister(shape: Shape): void {
    const ids = shape instanceof Group ? shape.walk() : [shape];
    for (const s of ids) this._index.delete(s.id);
  }

  /** 元素总数（不含根 svg 自身，含容器）。 */
  count(): number {
    let n = 0;
    for (const _ of this._root.walk()) n++;
    return n - 1;
  }

  /** show 中的父节点标签：顶级图形的父显示为 svg。 */
  parentLabel(shape: Shape): string {
    const p = shape.parent;
    if (!p || p === this._root) return "svg";
    return p.label;
  }

  isTopLevel(shape: Shape): boolean {
    return shape.parent === this._root;
  }
}
