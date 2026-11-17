import { isNumericLiteral } from "../../kernel/model/Format";
import { ModelError } from "../../kernel/model/Shape";
import type { PluginContext, PluginModule } from "../../kernel/api/Plugin";
import type { ShapeProvider } from "../../kernel/api/ShapeProvider";
import { parsePoints, PolygonShape } from "./PolygonShape";

/**
 * `diamond`（判断框）：`create diamond <id> <cx> <cy> <w> <h> [fill]`
 * 以中心点 + 宽高定义，四个顶点逆时针给出，
 * 因此与 rect 一样可以 move / scale / set 几何属性。
 */
const DEFAULT_FILL = "#f5a623";

function makeProvider(defaultFill: string): ShapeProvider {
  return {
    type: "diamond",
    usage: "create diamond <id> <cx> <cy> <width> <height> [fill] [in <containerId>]",
    // 序列化后是 <polygon>；读回时按标签名归属本插件
    readTags: ["polygon"],
    parse(args) {
      if (args.length < 4 || args.length > 5)
        throw new ModelError("wrong number of arguments");
      const pairs: [string, string][] = [
        ["cx", args[0]],
        ["cy", args[1]],
        ["width", args[2]],
        ["height", args[3]],
      ];
      if (args[4] !== undefined) pairs.push(["fill", args[4]]);
      return { attrs: new Map(pairs) };
    },
    create(id, spec) {
      // 读回路径：<polygon points="…"/> 直接还原顶点
      const pointsRaw = spec.attrs.get("points");
      if (pointsRaw !== undefined) {
        const pts = parsePoints(pointsRaw);
        if (pts === null) throw new ModelError(`invalid points: ${pointsRaw}`);
        return new PolygonShape(id, "polygon", pts);
      }
      const n = (k: string): number => {
        const raw = spec.attrs.get(k);
        if (raw === undefined || !isNumericLiteral(raw))
          throw new ModelError(`invalid number for ${k}: ${raw ?? ""}`);
        return Number(raw);
      };
      const cx = n("cx");
      const cy = n("cy");
      const w = n("width");
      const h = n("height");
      const shape = new PolygonShape(id, "polygon", [
        [cx, cy - h / 2],
        [cx + w / 2, cy],
        [cx, cy + h / 2],
        [cx - w / 2, cy],
      ]);
      // 缺省填充由插件决定（可通过 options.fill 覆盖）
      shape.initStyle(spec.attrs.get("fill") ?? defaultFill, null, null);
      return shape;
    },
  };
}

const plugin: PluginModule = {
  name: "@svgframe/plugin-shape-diamond",
  contributes: { shapes: ["diamond"] },
  activate(ctx: PluginContext) {
    const fill = ctx.options["fill"];
    ctx.registerShape(makeProvider(typeof fill === "string" ? fill : DEFAULT_FILL));
  },
};

export default plugin;
export { PolygonShape } from "./PolygonShape";
