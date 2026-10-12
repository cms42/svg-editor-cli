import { Circle } from "./Circle";
import { Ellipse } from "./Ellipse";
import { Group } from "./Group";
import { Line } from "./Line";
import { Rect } from "./Rect";
import { ModelError, Shape } from "./Shape";
import { TextShape } from "./TextShape";

/** 工厂拿到的是已解析的属性表与文本内容（CLI 与 SVG 解析器共用此入口）。 */
export interface ShapeSpec {
  attrs: ReadonlyMap<string, string>;
  text?: string;
}

export type ShapeCreator = (id: string, spec: ShapeSpec) => Shape;

/**
 * 图形工厂：全系统仅有的两处按名分派之一（另一处是命令分发）。
 * 以注册表形式存在，后续插件化阶段（box 等）往 register 挂新类型即可。
 */
export class ShapeFactory {
  private readonly creators = new Map<string, ShapeCreator>();

  register(tag: string, creator: ShapeCreator): void {
    this.creators.set(tag, creator);
  }

  isRegistered(tag: string): boolean {
    return this.creators.has(tag);
  }

  create(tag: string, id: string, spec: ShapeSpec): Shape {
    const c = this.creators.get(tag);
    if (!c)
      throw new ModelError(`unknown shape type: ${tag} (is the plugin loaded?)`);
    const shape = c(id, spec);
    shape.initStyle(
      spec.attrs.get("fill") ?? null,
      spec.attrs.get("stroke") ?? null,
      spec.attrs.get("stroke-width") ?? null
    );
    return shape;
  }

  static kernel(): ShapeFactory {
    const f = new ShapeFactory();
    const num = (spec: ShapeSpec, k: string, dflt = 0): number => {
      const raw = spec.attrs.get(k);
      if (raw === undefined) return dflt;
      const v = Number(raw);
      if (raw.trim() === "" || Number.isNaN(v))
        throw new ModelError(`invalid number for ${k}: ${raw}`);
      return v;
    };
    f.register("rect", (id, s) =>
      new Rect(id, num(s, "x"), num(s, "y"), num(s, "width"), num(s, "height"))
    );
    f.register("circle", (id, s) =>
      new Circle(id, num(s, "cx"), num(s, "cy"), num(s, "r"))
    );
    f.register("ellipse", (id, s) =>
      new Ellipse(id, num(s, "cx"), num(s, "cy"), num(s, "rx"), num(s, "ry"))
    );
    f.register("line", (id, s) =>
      new Line(id, num(s, "x1"), num(s, "y1"), num(s, "x2"), num(s, "y2"))
    );
    f.register("text", (id, s) =>
      new TextShape(id, num(s, "x"), num(s, "y"), s.text ?? "")
    );
    f.register("g", (id) => new Group(id));
    return f;
  }
}
