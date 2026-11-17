import type { ShapeProvider } from "../../kernel/api/ShapeProvider";
import { Circle } from "../../kernel/model/Circle";
import { Ellipse } from "../../kernel/model/Ellipse";
import { Group } from "../../kernel/model/Group";
import { Line } from "../../kernel/model/Line";
import { ModelError } from "../../kernel/model/Shape";
import { TextShape } from "../../kernel/model/TextShape";
import { Rect } from "../../kernel/model/Rect";
import { num, spec, take } from "./params";

/** 六种基础图形的 provider：一种类型一个实例，形如 `create <type>`。 */

export const rectProvider: ShapeProvider = {
  type: "rect",
  usage: "create rect <id> <x> <y> <width> <height> [fill] [in <containerId>]",
  parse: (a) => take(a, ["x", "y", "width", "height"], ["fill"]),
  create: (id, s) =>
    new Rect(id, num(s, "x"), num(s, "y"), num(s, "width"), num(s, "height")),
};

export const circleProvider: ShapeProvider = {
  type: "circle",
  usage: "create circle <id> <cx> <cy> <r> [fill] [in <containerId>]",
  parse: (a) => take(a, ["cx", "cy", "r"], ["fill"]),
  create: (id, s) => new Circle(id, num(s, "cx"), num(s, "cy"), num(s, "r")),
};

export const ellipseProvider: ShapeProvider = {
  type: "ellipse",
  usage: "create ellipse <id> <cx> <cy> <rx> <ry> [fill] [in <containerId>]",
  parse: (a) => take(a, ["cx", "cy", "rx", "ry"], ["fill"]),
  create: (id, s) =>
    new Ellipse(id, num(s, "cx"), num(s, "cy"), num(s, "rx"), num(s, "ry")),
};

export const lineProvider: ShapeProvider = {
  type: "line",
  usage: "create line <id> <x1> <y1> <x2> <y2> [stroke] [in <containerId>]",
  parse: (a) => take(a, ["x1", "y1", "x2", "y2"], ["stroke"]),
  create: (id, s) =>
    new Line(id, num(s, "x1"), num(s, "y1"), num(s, "x2"), num(s, "y2")),
};

export const textProvider: ShapeProvider = {
  type: "text",
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
};

export const groupProvider: ShapeProvider = {
  type: "g",
  usage: "create g <id> [in <containerId>]",
  parse: (a) => {
    if (a.length !== 0) throw new ModelError("wrong number of arguments");
    return spec([]);
  },
  create: (id) => new Group(id),
};

export const builtinShapeProviders: readonly ShapeProvider[] = [
  rectProvider,
  circleProvider,
  ellipseProvider,
  lineProvider,
  textProvider,
  groupProvider,
];
