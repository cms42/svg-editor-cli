import { Circle } from "./Circle";
import { Ellipse } from "./Ellipse";
import { isNumericLiteral } from "./Format";
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

export interface ShapeType {
  /** create 命令的参数个数与含义（usage 提示用）。 */
  usage: string;
  /** 把 CLI 参数解析为 ShapeSpec；参数不对抛 ModelError。 */
  parse(args: string[]): ShapeSpec;
  create(id: string, spec: ShapeSpec): Shape;
}

function num(spec: ShapeSpec, k: string, dflt = 0): number {
  const raw = spec.attrs.get(k);
  if (raw === undefined) return dflt;
  if (!isNumericLiteral(raw))
    throw new ModelError(`invalid number for ${k}: ${raw}`);
  return Number(raw);
}

function spec(pairs: [string, string][], text?: string): ShapeSpec {
  return { attrs: new Map(pairs), text };
}

function take(args: string[], names: string[], optional: string[] = []): ShapeSpec {
  const total = names.length + optional.length;
  if (args.length < names.length || args.length > total)
    throw new ModelError("wrong number of arguments");
  const pairs: [string, string][] = names.map((n, i) => [n, args[i]]);
  optional.forEach((n, k) => {
    const v = args[names.length + k];
    if (v !== undefined) pairs.push([n, v]);
  });
  return spec(pairs);
}

/**
 * 图形工厂：全系统仅有的两处按名分派之一（另一处是命令分发）。
 * 以注册表形式存在，后续插件化阶段（box 等）register 新类型即可，内核不改。
 */
export class ShapeFactory {
  private readonly types = new Map<string, ShapeType>();

  register(type: ShapeType, tag: string): void {
    this.types.set(tag, type);
  }

  isRegistered(tag: string): boolean {
    return this.types.has(tag);
  }

  usage(tag: string): string | null {
    return this.types.get(tag)?.usage ?? null;
  }

  /** CLI create：按类型解析参数。未知类型报 unknown shape type。 */
  parse(tag: string, args: string[]): ShapeSpec {
    const t = this.types.get(tag);
    if (!t)
      throw new ModelError(`unknown shape type: ${tag} (is the plugin loaded?)`);
    return t.parse(args);
  }

  create(tag: string, id: string, parsed: ShapeSpec): Shape {
    const t = this.types.get(tag);
    if (!t)
      throw new ModelError(`unknown shape type: ${tag} (is the plugin loaded?)`);
    const shape = t.create(id, parsed);
    shape.initStyle(
      parsed.attrs.get("fill") ?? null,
      parsed.attrs.get("stroke") ?? null,
      parsed.attrs.get("stroke-width") ?? null
    );
    return shape;
  }

  static kernel(): ShapeFactory {
    const f = new ShapeFactory();
    f.register(
      {
        usage: "create rect <id> <x> <y> <width> <height> [fill] [in <containerId>]",
        parse: (a) => take(a, ["x", "y", "width", "height"], ["fill"]),
        create: (id, s) =>
          new Rect(id, num(s, "x"), num(s, "y"), num(s, "width"), num(s, "height")),
      },
      "rect"
    );
    f.register(
      {
        usage: "create circle <id> <cx> <cy> <r> [fill] [in <containerId>]",
        parse: (a) => take(a, ["cx", "cy", "r"], ["fill"]),
        create: (id, s) => new Circle(id, num(s, "cx"), num(s, "cy"), num(s, "r")),
      },
      "circle"
    );
    f.register(
      {
        usage: "create ellipse <id> <cx> <cy> <rx> <ry> [fill] [in <containerId>]",
        parse: (a) => take(a, ["cx", "cy", "rx", "ry"], ["fill"]),
        create: (id, s) =>
          new Ellipse(id, num(s, "cx"), num(s, "cy"), num(s, "rx"), num(s, "ry")),
      },
      "ellipse"
    );
    f.register(
      {
        usage: "create line <id> <x1> <y1> <x2> <y2> [stroke] [in <containerId>]",
        parse: (a) => take(a, ["x1", "y1", "x2", "y2"], ["stroke"]),
        create: (id, s) =>
          new Line(id, num(s, "x1"), num(s, "y1"), num(s, "x2"), num(s, "y2")),
      },
      "line"
    );
    f.register(
      {
        usage: 'create text <id> <x> <y> "content" [in <containerId>]',
        parse: (a) => {
          if (a.length !== 3) throw new ModelError("wrong number of arguments");
          return spec(
            [
              ["x", a[0]],
              ["y", a[1]],
            ],
            a[2]
          );
        },
        create: (id, s) => new TextShape(id, num(s, "x"), num(s, "y"), s.text ?? ""),
      },
      "text"
    );
    f.register(
      {
        usage: "create g <id> [in <containerId>]",
        parse: (a) => {
          if (a.length !== 0) throw new ModelError("wrong number of arguments");
          return spec([]);
        },
        create: (id) => new Group(id),
      },
      "g"
    );
    return f;
  }
}
