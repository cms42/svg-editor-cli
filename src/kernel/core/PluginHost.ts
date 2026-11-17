import { CommandError } from "../api/Command";
import type { CommandHelp } from "../api/Command";
import type { AttributeHandler } from "../api/AttributeHandler";
import type { ShapeProvider } from "../api/ShapeProvider";
import type { TreeDecoratorFactory } from "../api/TreeDecorator";
import {
  MANIFEST_CATEGORIES,
  PluginLoadError,
} from "../api/Plugin";
import type {
  EditorServices,
  ManifestCategory,
  PluginContext,
  PluginManifest,
  PluginModule,
} from "../api/Plugin";
import type { EditorContext } from "./EditorContext";

/** 暂存区里的一批注册（尚未生效）。 */
interface StagedRegistration {
  category: ManifestCategory;
  name: string;
  commit: () => void;
}

/**
 * 插件宿主：唯一的装配入口。
 *
 * 代码装配（方式 A）与配置装配（方式 B）都只能走 `activate`，
 * 因此两条路径共用同一套注册、清单校验与回滚逻辑，行为不可能分叉。
 */
export class PluginHost {
  constructor(
    private readonly ctx: EditorContext,
    private readonly report: (line: string) => void
  ) {}

  /** 已成功装载的插件名（顺序即装载顺序）。 */
  private readonly loaded: string[] = [];

  loadedPlugins(): readonly string[] {
    return this.loaded;
  }

  editorServices(): EditorServices {
    return {
      events: this.ctx.events,
      cwd: this.ctx.cwd,
      currentDocument: () => this.ctx.doc,
      shapeTypes: () => this.ctx.shapes.types(),
    };
  }

  /**
   * 装载一个插件。任何失败都只打印一行 `error: …` 并返回 false，不中断启动。
   * 失败时该插件暂存的注册全部丢弃。
   */
  activate(plugin: PluginModule | null, options: Readonly<Record<string, unknown>> = {}): boolean {
    if (!plugin || typeof plugin.activate !== "function") return false;
    const name = typeof plugin.name === "string" ? plugin.name : "(anonymous)";

    const staged: StagedRegistration[] = [];
    const context = this.makeContext(staged, options);

    try {
      plugin.activate(context);
    } catch (e) {
      this.report(
        `error: plugin failed to activate: ${name} (${reasonOf(e)})`
      );
      return false;
    }

    const mismatch = this.checkManifest(name, plugin.contributes, staged);
    if (mismatch) {
      this.report(mismatch);
      return false;
    }

    const duplicate = this.checkDuplicates(staged);
    if (duplicate) {
      this.report(`error: duplicate registration: ${duplicate}`);
      return false;
    }

    for (const s of staged) s.commit();
    this.loaded.push(name);
    return true;
  }

  private makeContext(
    staged: StagedRegistration[],
    options: Readonly<Record<string, unknown>>
  ): PluginContext {
    const stage = (category: ManifestCategory, name: string, commit: () => void): void => {
      staged.push({ category, name, commit });
    };

    return {
      options,
      editor: this.editorServices(),
      registerShape: (provider: ShapeProvider): void => {
        this.assertName(provider.type);
        stage("shapes", provider.type, () => this.ctx.shapes.register(provider));
      },
      registerCommand: (name, factory, help) => {
        this.assertName(name);
        stage("commands", name, () => this.ctx.commands.register(name, factory, help));
      },
      registerHelp: (section: string, line: string): void => {
        stage("commands", "\u0000help:" + line, () =>
          this.ctx.commands.addHelpLine(section, line)
        );
      },
      registerDecorator: (name: string, factory: TreeDecoratorFactory): void => {
        this.assertName(name);
        stage("decorators", name, () => this.ctx.decorators.register(name, factory));
      },
      registerAttributeHandler: (handler: AttributeHandler): void => {
        this.assertName(handler.name);
        stage("attributes", handler.name, () => this.ctx.attributes.register(handler));
      },
    };
  }

  private assertName(name: string): void {
    if (typeof name !== "string" || name.length === 0)
      throw new CommandError("registration name must be a non-empty string");
  }

  /**
   * 清单校验：`contributes` 声明的类别与名称集合，必须与实际注册完全一致。
   * 缺省 `contributes` 视为四类皆空 —— 即要求插件确实什么都不注册。
   */
  private checkManifest(
    pluginName: string,
    declared: PluginManifest | undefined,
    staged: StagedRegistration[]
  ): string | null {
    const declaredSets = new Map<ManifestCategory, Set<string>>();
    for (const c of MANIFEST_CATEGORIES) {
      declaredSets.set(c, new Set(declared?.[c] ?? []));
    }
    const actualSets = new Map<ManifestCategory, Set<string>>();
    for (const c of MANIFEST_CATEGORIES) actualSets.set(c, new Set());
    for (const s of staged) {
      // help 行不参与清单（它不是一条命令）
      if (s.category === "commands" && s.name.startsWith("\u0000help:")) continue;
      actualSets.get(s.category)!.add(s.name);
    }

    const diffs: string[] = [];
    for (const c of MANIFEST_CATEGORIES) {
      const d = declaredSets.get(c)!;
      const a = actualSets.get(c)!;
      const missing = [...d].filter((n) => !a.has(n));
      const extra = [...a].filter((n) => !d.has(n));
      if (missing.length > 0) diffs.push(`${c}: declared but not registered [${missing.join(", ")}]`);
      if (extra.length > 0) diffs.push(`${c}: registered but not declared [${extra.join(", ")}]`);
    }
    if (diffs.length === 0) return null;
    return `error: plugin manifest mismatch: ${pluginName} (${diffs.join("; ")})`;
  }

  /** 同类注册名不得重复（含与已装载插件冲突）。 */
  private checkDuplicates(staged: StagedRegistration[]): string | null {
    const seen = new Set<string>();
    for (const s of staged) {
      if (s.category === "commands" && s.name.startsWith("\u0000help:")) continue;
      if (this.taken(s.category, s.name) || seen.has(`${s.category}/${s.name}`))
        return `${s.category}/${s.name}`;
      seen.add(`${s.category}/${s.name}`);
    }
    return null;
  }

  private taken(category: ManifestCategory, name: string): boolean {
    switch (category) {
      case "shapes":
        return this.ctx.shapes.get(name) !== undefined;
      case "commands":
        return this.ctx.commands.has(name);
      case "decorators":
        return this.ctx.decorators.names().includes(name);
      case "attributes":
        return this.ctx.attributes.names().includes(name);
    }
  }
}

function reasonOf(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

export { PluginLoadError };
