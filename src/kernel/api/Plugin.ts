import type { Action, Command, CommandHelp } from "./Command";
import type { AttributeHandler } from "./AttributeHandler";
import type { ShapeProvider } from "./ShapeProvider";
import type { TreeDecoratorFactory } from "./TreeDecorator";
import type { SvgDocument } from "../model/SvgDocument";

/** 命令工厂：内核只按名字把参数交给它，不认识具体命令。 */
export type CommandFactory = (
  ctx: import("../core/EditorContext").EditorContext,
  args: string[]
) => Command | Action;

/** 插件声明的贡献清单（`package.json` 的 `contributes`，或模块自身的同构字段）。 */
export interface PluginManifest {
  shapes?: readonly string[];
  commands?: readonly string[];
  decorators?: readonly string[];
  attributes?: readonly string[];
}

export const MANIFEST_CATEGORIES = [
  "shapes",
  "commands",
  "decorators",
  "attributes",
] as const;

export type ManifestCategory = (typeof MANIFEST_CATEGORIES)[number];

/** 内核向插件暴露的编辑器能力（只读）。 */
export interface EditorServices {
  /** 文档与保存相关事件；标签插件用它维护自己的基线。 */
  readonly events: EditorEvents;
  /** 启动时的工作目录（`dir` 等命令据此访问文件系统）。 */
  readonly cwd: string;
  currentDocument(): SvgDocument | null;
  /** 当前已注册的图形类型名（help 文案等只读用途）。 */
  shapeTypes(): string[];
}

export type EditorEventName = "document-opened" | "document-saved" | "document-edited";

/** 极小的同步事件总线，只供扩展点使用，不承载内核逻辑。 */
export class EditorEvents {
  private readonly listeners = new Map<EditorEventName, Set<() => void>>();

  on(event: EditorEventName, listener: () => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => set!.delete(listener);
  }

  emit(event: EditorEventName): void {
    for (const listener of this.listeners.get(event) ?? []) listener();
  }
}

/**
 * 插件在 activate 期间拿到的注册入口。
 * 所有注册先落到暂存区，清单校验通过后才提交进内核注册表；
 * 中途抛错则整批丢弃，不留半装状态。
 */
export interface PluginContext {
  /** 配置项里的 options，原样透传（代码装配时为空对象）。 */
  readonly options: Readonly<Record<string, unknown>>;
  readonly editor: EditorServices;

  registerShape(provider: ShapeProvider): void;
  registerCommand(name: string, factory: CommandFactory, help?: CommandHelp): void;
  /** 只往 help 里加行（例如 Repl 自己处理的 exit），不注册命令。 */
  registerHelp(section: string, line: string): void;
  registerDecorator(name: string, factory: TreeDecoratorFactory): void;
  registerAttributeHandler(handler: AttributeHandler): void;
}

/** 一个插件模块的默认导出形状。 */
export interface PluginModule {
  readonly name: string;
  /** 与 package.json 的 contributes 同构；代码装配路径用它做清单校验。 */
  readonly contributes?: PluginManifest;
  activate(ctx: PluginContext): void;
}

/** 加载/装配失败，message 已是最终要打印的那一行。 */
export class PluginLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PluginLoadError";
  }
}
