import { fmt } from "../../kernel/model/Format";
import { AttrPair, parseNumber, Shape } from "../../kernel/model/Shape";

/**
 * 多边形 —— 完全由插件提供，内核不认识它。
 * 顶点以 SVG 的 `points="x1,y1 x2,y2 …"` 形式序列化，
 * move/scale 直接作用于每个顶点。
 */
export class PolygonShape extends Shape {
  constructor(
    id: string,
    tag: string,
    private _points: [number, number][]
  ) {
    super(id);
    this._tagName = tag;
  }

  private readonly _tagName: string;

  get tag(): string {
    return this._tagName;
  }

  /** 回显与统计用类型名 diamond；SVG 标签仍是 polygon。 */
  override get displayTag(): string {
    return "diamond";
  }

  get points(): readonly [number, number][] {
    return this._points;
  }

  move(dx: number, dy: number): void {
    this._points = this._points.map(([x, y]) => [x + dx, y + dy] as [number, number]);
  }

  scale(factor: number): void {
    this._points = this._points.map(
      ([x, y]) => [x * factor, y * factor] as [number, number]
    );
  }

  /** 多边形的代表位置取第一个顶点（与 task 书对矩形取左上角一致）。 */
  position(): [number, number] {
    return this._points[0];
  }

  treeAttrs(): string {
    return this.withStyle(this.geometryLine());
  }

  geometryLine(): string {
    return `points=${this.pointsAttr()}`;
  }

  protected geometryAttrPairs(): AttrPair[] {
    return [["points", this.pointsAttr()]];
  }

  protected setGeometry(attr: string, raw: string): boolean {
    if (attr !== "points") return false;
    const pts = parsePoints(raw);
    if (pts === null) return false;
    this._points = pts;
    return true;
  }

  protected getGeometry(attr: string): string | null {
    return attr === "points" ? this.pointsAttr() : null;
  }

  private pointsAttr(): string {
    return this._points.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(" ");
  }
}

/** `"x1,y1 x2,y2 …"` → 顶点数组；格式不对返回 null。 */
export function parsePoints(raw: string): [number, number][] | null {
  const parts = raw.trim().split(/\s+/).filter((s) => s !== "");
  if (parts.length < 3) return null;
  const out: [number, number][] = [];
  for (const part of parts) {
    const [xs, ys] = part.split(",");
    if (xs === undefined || ys === undefined) return null;
    try {
      out.push([parseNumber(xs, "points"), parseNumber(ys, "points")]);
    } catch {
      return null;
    }
  }
  return out;
}
