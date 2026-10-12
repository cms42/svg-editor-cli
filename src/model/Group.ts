import { AttrPair, Shape } from "./Shape";

/** SVG <g> 容器（Composite 中的 Composite），与叶子图形统一操作。 */
export class Group extends Shape {
  private _children: Shape[] = [];

  constructor(id: string) {
    super(id);
  }

  get tag(): string {
    return "g";
  }

  override isContainer(): boolean {
    return true;
  }

  get children(): readonly Shape[] {
    return this._children;
  }

  childIndex(child: Shape): number {
    return this._children.indexOf(child);
  }

  addChild(child: Shape): void {
    child.parent = this;
    this._children.push(child);
  }

  insertChild(index: number, child: Shape): void {
    child.parent = this;
    this._children.splice(index, 0, child);
  }

  removeChild(child: Shape): void {
    const i = this.childIndex(child);
    if (i >= 0) {
      this._children.splice(i, 1);
      child.parent = null;
    }
  }

  move(dx: number, dy: number): void {
    for (const c of this._children) c.move(dx, dy);
  }

  scale(factor: number): void {
    for (const c of this._children) c.scale(factor);
  }

  position(): null {
    return null;
  }

  treeAttrs(): string {
    return "";
  }

  geometryLine(): string {
    return `children=${this._children.length}`;
  }

  protected geometryAttrPairs(): AttrPair[] {
    return [];
  }

  protected setGeometry(): boolean {
    return false;
  }

  /** 深度优先遍历（先序，含自身）。 */
  *walk(): Generator<Shape> {
    yield this;
    for (const c of this._children) {
      if (c instanceof Group) yield* c.walk();
      else yield c;
    }
  }
}
