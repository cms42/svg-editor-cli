import type { PluginModule } from "../../kernel/api/Plugin";
import { ModifiedStar } from "./ModifiedStar";

/**
 * `modified-star` 树标签插件。
 * 工厂闭包持有编辑器服务（事件总线 + 当前文档），
 * 因此每个编辑器实例得到独立的标签实例与独立基线。
 */
const plugin: PluginModule = {
  name: "@svgframe/plugin-tree-star",
  contributes: { decorators: ["modified-star"] },
  activate(ctx) {
    ctx.registerDecorator("modified-star", () => new ModifiedStar(ctx.editor));
  },
};

export default plugin;
export { ModifiedStar, signature } from "./ModifiedStar";
