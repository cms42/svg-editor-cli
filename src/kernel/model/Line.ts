import { fmt } from "./Format";
import { AttrPair, parseNumber, Shape } from "./Shape";

export class Line extends Shape {
  private _x1: number;
  private _y1: number;
  private _x2: number;
  private _y2: number;

  constructor(id: string, x1: number, y1: number, x2: number, y2: number) {
    super(id);
    this._x1 = x1;
    this._y1 = y1;
    this._x2 = x2;
    this._y2 = y2;
  }

  get tag(): string {
    return "line";
  }

  get x1(): number {
    return this._x1;
  }
  get y1(): number {
    return this._y1;
  }
  get x2(): number {
    return this._x2;
  }
  get y2(): number {
    return this._y2;
  }

  move(dx: number, dy: number): void {
    this._x1 += dx;
    this._y1 += dy;
    this._x2 += dx;
    this._y2 += dy;
  }

  scale(factor: number): void {
    this._x1 *= factor;
    this._y1 *= factor;
    this._x2 *= factor;
    this._y2 *= factor;
  }

  position(): [number, number] {
    return [this._x1, this._y1];
  }

  treeAttrs(): string {
    // 任务书示例中 line 不内联 stroke
    return `(${fmt(this._x1)},${fmt(this._y1)}) -> (${fmt(this._x2)},${fmt(this._y2)})`;
  }

  geometryLine(): string {
    return `x1=${fmt(this._x1)} y1=${fmt(this._y1)} x2=${fmt(this._x2)} y2=${fmt(this._y2)}`;
  }

  protected geometryAttrPairs(): AttrPair[] {
    return [
      ["x1", fmt(this._x1)],
      ["y1", fmt(this._y1)],
      ["x2", fmt(this._x2)],
      ["y2", fmt(this._y2)],
    ];
  }

  protected setGeometry(attr: string, raw: string): boolean {
    switch (attr) {
      case "x1":
        this._x1 = parseNumber(raw, attr);
        return true;
      case "y1":
        this._y1 = parseNumber(raw, attr);
        return true;
      case "x2":
        this._x2 = parseNumber(raw, attr);
        return true;
      case "y2":
        this._y2 = parseNumber(raw, attr);
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
      case "x1":
        return fmt(this._x1);
      case "y1":
        return fmt(this._y1);
      case "x2":
        return fmt(this._x2);
      case "y2":
        return fmt(this._y2);
      default:
        return null;
    }
  }
}
