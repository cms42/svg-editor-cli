import type { Editor } from "./Editor";
import builtinPlugin from "../builtin";
import boxPlugin from "../plugins/shape-box";
import statsPlugin from "../plugins/stats";
import dirPlugin from "../plugins/dir";
import starPlugin from "../plugins/tree-star";

/**
 * 装配方式 A：代码装配（组合根）。
 *
 * 内置插件与四个可选插件在这里各占一行；新增插件 = 加一行 activate + 重新构建。
 * 内核、装载器、既有插件一律不动 —— 这就是 A 方式的全部代价。
 *
 * 配置装配（方式 B）读 plugins.config.json，同一批插件走同一条
 * PluginHost.activate 路径，注册、清单校验、回滚逻辑完全一致。
 */
export function codeAssembly(editor: Editor): void {
  // Phase 1 等价能力：六种图形 + 全部内置命令
  editor.host.activate(builtinPlugin);

  // 本阶段新增的插件（每个对应一个扩展点，box 同时占三类）
  editor.host.activate(boxPlugin); // ShapeProvider + AttributeHandler + TreeDecorator
  editor.host.activate(starPlugin); // TreeDecorator
  editor.host.activate(statsPlugin); // Command
  editor.host.activate(dirPlugin); // Command（经适配器访问文件系统）
}
