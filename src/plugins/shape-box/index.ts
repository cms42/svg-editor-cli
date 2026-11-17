import type { PluginModule } from "../../kernel/api/Plugin";
import { BoxAttributeHandler } from "./BoxAttributeHandler";
import { BoxTypeLabel } from "./BoxTypeLabel";
import boxProvider from "./boxProvider";

/**
 * `box` 插件：一个插件包同时提供三类扩展
 * （图形类型、属性语义、树标签），彼此通过内核接口协作，
 * 跨插件界限的一个用例是 `stats` 会把 box 计为 containers、
 * 把内部矩形与文字计为叶子。
 */
const plugin: PluginModule = {
  name: "@svgframe/plugin-shape-box",
  contributes: {
    shapes: ["box"],
    attributes: ["box-attributes"],
    decorators: ["box-type-label"],
  },
  activate(ctx) {
    ctx.registerShape(boxProvider);
    ctx.registerAttributeHandler(new BoxAttributeHandler());
    ctx.registerDecorator("box-type-label", () => new BoxTypeLabel());
  },
};

export default plugin;
export { BoxShape } from "./BoxShape";
export { boxProvider } from "./boxProvider";
