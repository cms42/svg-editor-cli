import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import { createRequire } from "module";
import type { PluginModule, PluginManifest } from "../kernel/api/Plugin";

/** plugins.config.json 的一项。 */
export interface PluginConfigEntry {
  module: string;
  options?: Record<string, unknown>;
  enabled?: boolean;
}

export interface PluginConfig {
  plugins: PluginConfigEntry[];
}

/** 加载器的产物：可装载的插件模块，或一条要原样打印的错误行。 */
export type LoadResult =
  | {
      ok: true;
      spec: string;
      module: PluginModule;
      options: Record<string, unknown>;
    }
  | { ok: false; spec: string; error: string };

const requireFromConfig = createRequire(__filename);

/**
 * 严格解析配置结构。任何不合法都返回 null —— 由调用方打印
 * `error: invalid plugin config` 并以默认内置能力启动。
 */
export function parsePluginConfig(raw: unknown): PluginConfig | null {
  if (typeof raw !== "object" || raw === null) return null;
  const plugins = (raw as { plugins?: unknown }).plugins;
  if (!Array.isArray(plugins)) return null;
  const out: PluginConfigEntry[] = [];
  for (const item of plugins) {
    if (typeof item !== "object" || item === null) return null;
    const entry = item as Record<string, unknown>;
    if (typeof entry.module !== "string" || entry.module.length === 0) return null;
    if (entry.enabled !== undefined && typeof entry.enabled !== "boolean") return null;
    let options: Record<string, unknown> = {};
    if (entry.options !== undefined) {
      if (
        typeof entry.options !== "object" ||
        entry.options === null ||
        Array.isArray(entry.options)
      )
        return null;
      options = entry.options as Record<string, unknown>;
    }
    out.push({
      module: entry.module,
      options,
      enabled: entry.enabled as boolean | undefined,
    });
  }
  return { plugins: out };
}

/**
 * 按模块名解析并求值一个插件。
 *
 * - 相对路径 / 绝对路径：以**配置文件所在目录**为基准；
 * - 其它：按运行环境的模块解析规则（包名、子路径、node_modules）解析。
 *
 * 四类失败中的前两类在这里判定：
 *  - 解析不到 → `plugin not found`；
 *  - 求值（含其依赖）抛错 → `plugin failed to activate`，绝不误报成找不到；
 *  - 没有默认导出 / 默认导出不是插件 → `plugin has no default export`。
 */
export async function loadPluginModule(
  spec: string,
  configDir: string
): Promise<LoadResult> {
  const isPath =
    spec.startsWith("./") || spec.startsWith("../") || path.isAbsolute(spec);
  const baseDir = isPath ? configDir : process.cwd();

  let resolvedPath: string;
  try {
    resolvedPath = isPath
      ? requireFromConfig.resolve(path.resolve(configDir, spec))
      : requireFromConfig.resolve(spec, { paths: [baseDir, __dirname] });
  } catch {
    return { ok: false, spec, error: `error: plugin not found: ${spec}` };
  }

  let mod: unknown;
  try {
    mod = await import(pathToFileURL(resolvedPath).href);
  } catch (e) {
    return {
      ok: false,
      spec,
      error: `error: plugin failed to activate: ${spec} (${reason(e)})`,
    };
  }

  const exported = unwrapDefault(mod);
  if (
    typeof exported !== "object" ||
    exported === null ||
    typeof (exported as PluginModule).activate !== "function"
  ) {
    return { ok: false, spec, error: `error: plugin has no default export: ${spec}` };
  }

  const plugin = exported as PluginModule;
  const manifest = mergeManifest(plugin.contributes, readPackageContributes(resolvedPath));
  return {
    ok: true,
    spec,
    module: manifest ? { ...plugin, contributes: manifest } : plugin,
    options: {},
  };
}

/** ES module 命名空间 / CommonJS 互操作的兼容拆包。 */
function unwrapDefault(mod: unknown): unknown {
  if (typeof mod !== "object" || mod === null) return undefined;
  const d = (mod as Record<string, unknown>)["default"];
  if (d === undefined) return undefined;
  if (typeof d === "object" && d !== null) {
    const nested = (d as Record<string, unknown>)["default"];
    if (
      typeof (d as PluginModule).activate !== "function" &&
      typeof nested === "object" &&
      nested !== null
    )
      return nested;
  }
  return d;
}

/**
 * `contributes` 以 package.json 为准，模块自身的同构字段作为补充。
 * 只读解析目录向上最近的 package.json（即插件包自己的清单）。
 */
function readPackageContributes(resolvedPath: string): PluginManifest | null {
  let dir = path.dirname(resolvedPath);
  for (let i = 0; i < 6; i++) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
          contributes?: PluginManifest;
        };
        return pkg.contributes ?? null;
      } catch {
        return null;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function mergeManifest(
  a: PluginManifest | undefined,
  b: PluginManifest | null
): PluginManifest | undefined {
  if (!a) return b ?? undefined;
  if (!b) return a;
  const out: PluginManifest = {};
  for (const k of ["shapes", "commands", "decorators", "attributes"] as const) {
    const merged = new Set([...(a[k] ?? []), ...(b[k] ?? [])]);
    if (merged.size > 0) out[k] = [...merged];
  }
  return out;
}

export function reason(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
