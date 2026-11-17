/**
 * 启动装配套件：内核只在这里被组装成一台可用的编辑器。
 *
 * - `createEditor()` 建空壳（只有注册表与事件总线，没有任何图形/命令）；
 * - `boot()` 装内置插件，得到 Phase 1 的等价能力；
 * - `PluginHost`（kernel/core）承担所有注册、清单校验与回滚。
 *
 * 本目录**不属于内核**：插件可以依赖 kernel/api 与 kernel/model，
 * 但内核任何文件都不 import 这里，装配策略因此可以整体替换。
 */
import { AttributeRegistry } from "../kernel/core/AttributeRegistry";
import { CommandRegistry } from "../kernel/core/CommandRegistry";
import { DecoratorRegistry } from "../kernel/core/DecoratorRegistry";
import { EditorContext } from "../kernel/core/EditorContext";
import { PluginHost } from "../kernel/core/PluginHost";
import { ShapeRegistry } from "../kernel/core/ShapeRegistry";
import { EditorEvents } from "../kernel/api/Plugin";
import type { PluginModule } from "../kernel/api/Plugin";
import builtinPlugin from "../builtin";

export interface Editor {
  ctx: EditorContext;
  host: PluginHost;
  /** 启动期间打印的错误行（插件装载失败等），由 CLI 在 banner 后输出。 */
  startupErrors: string[];
}

export function createEditor(cwd: string = process.cwd()): Editor {
  const startupErrors: string[] = [];
  const ctx = new EditorContext(
    new ShapeRegistry(),
    new CommandRegistry(),
    new DecoratorRegistry(),
    new AttributeRegistry(),
    new EditorEvents(),
    cwd
  );
  const host = new PluginHost(ctx, (line) => startupErrors.push(line));
  return { ctx, host, startupErrors };
}

/** 装载内置插件（Phase 1 能力的等价物）。禁用插件时连这一步都不做。 */
export function activateBuiltin(editor: Editor): boolean {
  return editor.host.activate(builtinPlugin);
}

/** 方式 A 用：在组合根按代码显式 activate 一串插件。 */
export function activateAll(editor: Editor, plugins: readonly PluginModule[]): void {
  for (const p of plugins) editor.host.activate(p);
}
