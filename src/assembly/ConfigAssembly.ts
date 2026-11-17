import * as fs from "fs";
import * as path from "path";
import type { Editor } from "./Editor";
import builtinPlugin from "../builtin";
import { loadPluginModule, parsePluginConfig, reason } from "./PluginLoader";
import type { PluginConfig } from "./PluginLoader";

/**
 * 装配方式 B：读配置文件，按数组顺序装载插件。
 *
 * 本文件的全部行为都由 `plugins.config.json` 的**内容**驱动：
 * 没有插件名硬编码、没有名称映射表、没有按类别分支。
 * 接入新插件只改配置，装载器一行不动。
 *
 * 配置本身不合法 → 打印 `error: invalid plugin config`，不装任何插件。
 */
export async function loadFromConfig(editor: Editor, configPath: string): Promise<void> {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    editor.startupErrors.push(
      fs.existsSync(configPath)
        ? "error: invalid plugin config"
        : `error: cannot read file: ${configPath}`
    );
    return;
  }

  const config: PluginConfig | null = parsePluginConfig(raw);
  if (!config) {
    editor.startupErrors.push("error: invalid plugin config");
    return;
  }

  const configDir = path.dirname(path.resolve(configPath));

  // 内置能力也以插件形式装载：配置只决定"额外"装哪些，
  // 这样 Phase 1 的默认装配在任何配置下都保持不变。
  editor.host.activate(builtinPlugin);

  for (const entry of config.plugins) {
    if (entry.enabled === false) continue;
    const loaded = await loadPluginModule(entry.module, configDir);
    if (!loaded.ok) {
      editor.startupErrors.push(loaded.error);
      continue;
    }
    try {
      editor.host.activate(loaded.module, entry.options ?? {});
    } catch (e) {
      editor.startupErrors.push(
        `error: plugin failed to activate: ${loaded.spec} (${reason(e)})`
      );
    }
  }
}
