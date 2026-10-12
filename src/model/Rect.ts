import { fmt } from "./Format";
import { AttrPair, parseNumber, Shape } from "./Shape";

export class Rect extends Shape {
  private _x: number;
  private _y: number;
  private _width: number;
  private _height: number;

  constructor(id: string, x: number, y: number, width: number, height: number) {
    super(id);
    this._x = x;
    this._y = y;
    this._width = width;
    this._height = height;
  }

  get tag(): string {
    return "rect";
  }

  get x(): number {
    return this._x;
  }
  get y(): number {
    return this._y;
  }
  get width(): number {
    return this._width;
  }
  get height(): number {
    return this._height;
  }

  move(dx: number, dy: number): void {
    this._x += dx;
    this._y += dy;
  }

  scale(factor: number): void {
    this._x *= factor;
    this._y *= factor;
    this._width *= factor;
    this._height *= factor;
  }

  position(): [number, number] {
    return [this._x, this._y];
  }

  treeAttrs(): string {
    return this.withStyle(this.geometryLine());
  }

  geometryLine(): string {
    return `x=${fmt(this._x)} y=${fmt(this._y)} w=${fmt(this._width)} h=${fmt(this._height)}`;
  }

  protected geometryAttrPairs(): AttrPair[] {
    return [
      ["x", fmt(this._x)],
      ["y", fmt(this._y)],
      ["width", fmt(this._width)],
      ["height", fmt(this._height)],
    ];
  }

  protected setGeometry(attr: string, raw: string): boolean {
    switch (attr) {
      case "x":
        this._x = parseNumber(raw, attr);
        return true;
      case "y":
        this._y = parseNumber(raw, attr);
        return true;
      case "width":
        this._width = parseNumber(raw, attr);
        return true;
      case "height":
        this._height = parseNumber(raw, attr);
        return true;
      default:
        return false;
    }
  }

  protected override describeSet(attr: string, raw: string): string {
    return `${attr}=${fmt(parseNumber(raw, attr))}`;
  }
}
