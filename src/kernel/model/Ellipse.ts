import { fmt } from "./Format";
import { AttrPair, parseNumber, Shape } from "./Shape";

export class Ellipse extends Shape {
  private _cx: number;
  private _cy: number;
  private _rx: number;
  private _ry: number;

  constructor(id: string, cx: number, cy: number, rx: number, ry: number) {
    super(id);
    this._cx = cx;
    this._cy = cy;
    this._rx = rx;
    this._ry = ry;
  }

  get tag(): string {
    return "ellipse";
  }

  get cx(): number {
    return this._cx;
  }
  get cy(): number {
    return this._cy;
  }
  get rx(): number {
    return this._rx;
  }
  get ry(): number {
    return this._ry;
  }

  move(dx: number, dy: number): void {
    this._cx += dx;
    this._cy += dy;
  }

  scale(factor: number): void {
    this._cx *= factor;
    this._cy *= factor;
    this._rx *= factor;
    this._ry *= factor;
  }

  position(): [number, number] {
    return [this._cx, this._cy];
  }

  treeAttrs(): string {
    return this.withStyle(this.geometryLine());
  }

  geometryLine(): string {
    return `cx=${fmt(this._cx)} cy=${fmt(this._cy)} rx=${fmt(this._rx)} ry=${fmt(this._ry)}`;
  }

  protected geometryAttrPairs(): AttrPair[] {
    return [
      ["cx", fmt(this._cx)],
      ["cy", fmt(this._cy)],
      ["rx", fmt(this._rx)],
      ["ry", fmt(this._ry)],
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
      case "rx":
        this._rx = parseNumber(raw, attr);
        return true;
      case "ry":
        this._ry = parseNumber(raw, attr);
        return true;
      default:
        return false;
    }
  }

  protected override describeSet(attr: string, raw: string): string {
    return `${attr}=${fmt(parseNumber(raw, attr))}`;
  }

  protected getGeometry(attr: string): string | null {
    switch (attr) {
      case "cx":
        return fmt(this._cx);
      case "cy":
        return fmt(this._cy);
      case "rx":
        return fmt(this._rx);
      case "ry":
        return fmt(this._ry);
      default:
        return null;
    }
  }
}
