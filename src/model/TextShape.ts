import { fmt } from "./Format";
import { AttrPair, parseNumber, Shape } from "./Shape";

/** SVG <text>：内容为子文本而非属性。 */
export class TextShape extends Shape {
  private _x: number;
  private _y: number;
  private _text: string;

  constructor(id: string, x: number, y: number, text: string) {
    super(id);
    this._x = x;
    this._y = y;
    this._text = text;
  }

  get tag(): string {
    return "text";
  }

  get x(): number {
    return this._x;
  }
  get y(): number {
    return this._y;
  }

  get text(): string {
    return this._text;
  }

  set text(v: string) {
    this._text = v;
  }

  move(dx: number, dy: number): void {
    this._x += dx;
    this._y += dy;
  }

  scale(factor: number): void {
    this._x *= factor;
    this._y *= factor;
  }

  position(): [number, number] {
    return [this._x, this._y];
  }

  override textContent(): string {
    return this._text;
  }

  treeAttrs(): string {
    return `(${fmt(this._x)},${fmt(this._y)}) "${this._text}"`;
  }

  geometryLine(): string {
    return `x=${fmt(this._x)} y=${fmt(this._y)} text="${this._text}"`;
  }

  protected geometryAttrPairs(): AttrPair[] {
    return [
      ["x", fmt(this._x)],
      ["y", fmt(this._y)],
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
      case "text":
        this._text = raw;
        return true;
      default:
        return false;
    }
  }

  protected override describeSet(attr: string, raw: string): string {
    if (attr === "text") return `text="${raw}"`;
    return `${attr}=${fmt(parseNumber(raw, attr))}`;
  }
}
