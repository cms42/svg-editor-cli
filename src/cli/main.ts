import * as readline from "readline";
import * as path from "path";
import { Repl } from "./Repl";
import { createEditor } from "../assembly/Editor";
import type { Editor } from "../assembly/Editor";
import { loadFromConfig } from "../assembly/ConfigAssembly";
import { codeAssembly } from "../assembly/PluginSet";

const BANNER = "svg-editor 0.1 — type 'help' for commands";

interface Args {
  config: string | null;
  noPlugins: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { config: null, noPlugins: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--config") out.config = argv[++i] ?? null;
    else if (a.startsWith("--config=")) out.config = a.slice("--config=".length);
    else if (a === "--no-plugins") out.noPlugins = true;
  }
  return out;
}

/**
 * 两种装配方式的分叉点 —— 也是**唯一**的分叉点。
 *
 * - 默认（方式 A）：组合根里按代码 activate，类型检查完整；
 * - `--config <file>`（方式 B）：装载器按配置装载，运行时代码一行不改；
 * - `--no-plugins`：什么都不装，验证内核在没有插件时也能启动。
 *
 * 三种情况后续都走同一条 PluginHost.activate 路径。
 */
async function buildEditor(args: Args): Promise<Editor> {
  const editor = createEditor();
  if (args.noPlugins) return editor;
  if (args.config !== null) {
    await loadFromConfig(editor, path.resolve(args.config));
    return editor;
  }
  codeAssembly(editor);
  return editor;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const editor = await buildEditor(args);
  const repl = new Repl(editor.ctx);

  console.log(BANNER);
  for (const line of editor.startupErrors) console.log(line);

  const interactive = process.stdin.isTTY === true;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: interactive,
  });
  if (interactive) rl.setPrompt("svg> "), rl.prompt();
  rl.on("line", (line: string) => {
    const keepGoing = repl.handleLine(line);
    if (!keepGoing) {
      rl.close();
      return;
    }
    if (interactive) rl.prompt();
  });
  rl.on("close", () => process.exit(0));
}

void main();
