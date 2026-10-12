import { fmt } from "./Format";
import { AttrPair, parseNumber, Shape } from "./Shape";

export class Circle extends Shape {
  private _cx: number;
  private _cy: number;
  private _r: number;

  constructor(id: string, cx: number, cy: number, r: number) {
    super(id);
    this._cx = cx;
    this._cy = cy;
    this._r = r;
  }

  get tag(): string {
    return "circle";
  }

  get cx(): number {
    return this._cx;
  }
  get cy(): number {
    return this._cy;
  }
  get r(): number {
    return this._r;
  }

  move(dx: number, dy: number): void {
    this._cx += dx;
    this._cy += dy;
  }

  scale(factor: number): void {
    this._cx *= factor;
    this._cy *= factor;
    this._r *= factor;
  }

  position(): [number, number] {
    return [this._cx, this._cy];
  }

  treeAttrs(): string {
    return this.withStyle(this.geometryLine());
  }

  geometryLine(): string {
    return `cx=${fmt(this._cx)} cy=${fmt(this._cy)} r=${fmt(this._r)}`;
  }

  protected geometryAttrPairs(): AttrPair[] {
    return [
      ["cx", fmt(this._cx)],
      ["cy", fmt(this._cy)],
      ["r", fmt(this._r)],
    ];
  }

  protected setGeometry(attr: string, raw: string): boolean {
    switch (attr) {
      case "cx":
        this._cx = parseNumber(raw, attr);
        return true;
      case "cy":
        this._cy = parseNumber(raw, attr);
        return true;
      case "r":
        this._r = parseNumber(raw, attr);
        return true;
      default:
        return false;
    }
  }

  protected override describeSet(attr: string, raw: string): string {
    return `${attr}=${fmt(parseNumber(raw, attr))}`;
  }
}
