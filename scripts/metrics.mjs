#!/usr/bin/env node
/**
 * docs/metrics 生成器：所有数字都从 git 历史与源码现场算出，不接受手填。
 *
 * 用法：node scripts/metrics.mjs [baseRef] [headRef]
 *   默认 baseRef = tag `final`（Phase 1），headRef = 工作区（p2）。
 *
 * 统计口径（任务书 §7 第 4 项）：
 *   - 只算 CLI 范围，排除 vscode-extension/（单独一节列出）；
 *   - 排除依赖包与构建产物；
 *   - 行数按「内核 / 装配处 / 插件」三类拆分；
 *   - 圈复杂度增量对比 final 与当前版本（每个函数的判定点计数）。
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const BASE = process.argv[2] ?? "final";
// 当前版本默认读**工作区**（可以统计尚未提交的改动）；传 git ref 则读该提交
const HEAD = process.argv[3] ?? "WORKTREE";

const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
process.chdir(ROOT);

const git = (args) => execFileSync("git", args, { encoding: "utf8" });

/** 版本对应的文件清单：工作区用 HEAD，其他 ref 用 git ls-tree。 */
function walk(dir, acc) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "out") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name.endsWith(".ts")) acc.push(path.relative(ROOT, full));
  }
  return acc;
}

function listFiles(ref) {
  if (ref === "WORKTREE") {
    const files = walk(ROOT, []);
    // 只统计仓库内的源码目录
    return files.filter(
      (f) =>
        f.startsWith("src/") || f.startsWith("vscode-extension/src/")
    );
  }
  const out = git(["ls-tree", "-r", "--name-only", ref]);
  return out.split("\n").filter((f) => f.endsWith(".ts"));
}

function readFileAt(ref, file) {
  if (ref === "WORKTREE") return readFileSync(path.join(ROOT, file), "utf8");
  return git(["show", `${ref}:${file}`]);
}

/**
 * 分类规则：
 *   kernel   —— 内核（api/core/io/model，及 Phase 1 时代的同义目录）
 *   assembly —— 装配处（组合根、装载器、CLI 入口）
 *   plugin   —— 插件（内置插件与可选插件）
 *   其他     —— Phase 1 遗留结构里的 model/io/command，归入 kernel/plugin 见下
 */
function classify(file) {
  if (file.startsWith("vscode-extension/")) return "vscode";
  if (file.startsWith("src/kernel/")) return "kernel";
  if (file.startsWith("src/assembly/") || file.startsWith("src/cli/")) return "assembly";
  if (file.startsWith("src/plugins/")) return "plugin";
  if (file.startsWith("src/builtin/")) return "plugin";
  // Phase 1 结构：model+io+command 都是当时的内核与命令实现
  if (file.startsWith("src/model/") || file.startsWith("src/io/")) return "kernel";
  if (file.startsWith("src/command/") || file.startsWith("src/cli/")) {
    return file.startsWith("src/cli/") ? "assembly" : "plugin";
  }
  return "other";
}

function countLines(text) {
  if (text === "") return { total: 0, code: 0, comment: 0, blank: 0 };
  const lines = text.split("\n");
  let code = 0;
  let comment = 0;
  let blank = 0;
  let inBlock = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (inBlock) {
      comment++;
      if (line.includes("*/")) inBlock = false;
      continue;
    }
    if (line === "") blank++;
    else if (line.startsWith("//")) comment++;
    else if (line.startsWith("/*")) {
      comment++;
      if (!line.includes("*/")) inBlock = true;
    } else code++;
  }
  return { total: lines.length, code, comment, blank };
}

/**
 * 圈复杂度：函数级判定点累计 + 1。
 * 判定点 = if / else if / for / while / case / catch / && / || / ?? / 三元。
 * 这是脚本化的近似值（不是完整的 McCabe），用于版本间**增量对比**足够。
 */
const COMPLEXITY_TOKENS = [
  /\bif\s*\(/g,
  /\bfor\s*\(/g,
  /\bwhile\s*\(/g,
  /\bcase\s+/g,
  /\bcatch\s*\(/g,
  /&&/g,
  /\|\|/g,
  /\?\?/g,
  /\?\s*[^.:]/g,
];

function complexityOf(text) {
  let total = 0;
  const perFn = [];
  // 以 `function name(`、`name(...) {`（方法简写）、箭头函数 `=> {` 为切分点做近似
  const fnStarts = [...text.matchAll(/^(\s*)(?:export\s+)?(?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{|(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?[A-Za-z_$][\w$]*\s*=>)/gm)];

  if (fnStarts.length === 0) return { total: 0, perFn };

  for (let i = 0; i < fnStarts.length; i++) {
    const start = fnStarts[i].index;
    const end = i + 1 < fnStarts.length ? fnStarts[i + 1].index : text.length;
    const body = text.slice(start, end);
    let c = 1;
    for (const re of COMPLEXITY_TOKENS) c += (body.match(re) ?? []).length;
    const name =
      fnStarts[i][2] || fnStarts[i][3] || fnStarts[i][4] || fnStarts[i][5] || "(anonymous)";
    total += c;
    perFn.push({ name, complexity: c });
  }
  return { total, perFn };
}

function analyze(ref) {
  const files = listFiles(ref);
  const buckets = { kernel: [], assembly: [], plugin: [], vscode: [], other: [] };
  const lines = { kernel: 0, assembly: 0, plugin: 0, vscode: 0, other: 0 };
  const codeLines = { kernel: 0, assembly: 0, plugin: 0, vscode: 0, other: 0 };
  let complexity = 0;
  const complexByBucket = { kernel: 0, assembly: 0, plugin: 0, vscode: 0, other: 0 };

  for (const file of files) {
    const bucket = classify(file);
    let text;
    try {
      text = readFileAt(ref, file);
    } catch {
      continue;
    }
    const l = countLines(text);
    buckets[bucket].push({ file, lines: l.total, code: l.code });
    lines[bucket] += l.total;
    codeLines[bucket] += l.code;
    const c = complexityOf(text).total;
    complexity += c;
    complexByBucket[bucket] += c;
  }
  return { ref, buckets, lines, codeLines, complexity, complexByBucket };
}

const base = analyze(BASE);
const head = analyze(HEAD);

const fmtDelta = (a, b) => {
  const d = b - a;
  return `${d >= 0 ? "+" : ""}${d}`;
};

const rows = [];
const push = (s = "") => rows.push(s);

push("# CLI 指标（由 scripts/metrics.mjs 从 git 历史生成）");
push("");
push(`- 基线：\`${BASE}\`（Phase 1 提交）`);
push(`- 当前：\`${HEAD === "WORKTREE" ? "工作区（p2 收尾）" : HEAD}\``);
push("- 范围：CLI（`src/`），排除依赖包与构建产物；VSCode 扩展单独一节");
push("- 数字全部由脚本现场计算，不接受手填");
push("");

push("## 1. 行数按职责拆分");
push("");
push("| 类别 | 包含目录 | " + BASE + " 行数 | " + HEAD + " 行数 | 增量 |");
push("|---|---|---:|---:|---:|");
const dirsOf = {
  kernel: "`src/kernel/`（Phase 1: `src/model/` `src/io/` `src/command/Command.ts` `History.ts`）",
  assembly: "`src/assembly/` `src/cli/`",
  plugin: "`src/builtin/` `src/plugins/`（Phase 1: `src/command/` 各命令）",
};
for (const b of ["kernel", "assembly", "plugin"]) {
  push(`| ${b} | ${dirsOf[b]} | ${base.lines[b]} | ${head.lines[b]} | ${fmtDelta(base.lines[b], head.lines[b])} |`);
}
const baseTotal = base.lines.kernel + base.lines.assembly + base.lines.plugin;
const headTotal = head.lines.kernel + head.lines.assembly + head.lines.plugin;
push(`| **合计** | | **${baseTotal}** | **${headTotal}** | **${fmtDelta(baseTotal, headTotal)}** |`);
push("");

push("## 2. 圈复杂度（函数级判定点累计，脚本近似 McCabe）");
push("");
push("| 类别 | " + BASE + " | " + HEAD + " | 增量 |");
push("|---|---:|---:|---:|");
for (const b of ["kernel", "assembly", "plugin"]) {
  push(`| ${b} | ${base.complexByBucket[b]} | ${head.complexByBucket[b]} | ${fmtDelta(base.complexByBucket[b], head.complexByBucket[b])} |`);
}
const baseComplex = base.complexByBucket.kernel + base.complexByBucket.assembly + base.complexByBucket.plugin;
const headComplex = head.complexByBucket.kernel + head.complexByBucket.assembly + head.complexByBucket.plugin;
push(`| **合计** | **${baseComplex}** | **${headComplex}** | **${fmtDelta(baseComplex, headComplex)}** |`);
push("");
push("> 复杂度上升主要来自扩展点的契约校验与失败回滚（加载器、清单比对、事务日志），");
push("> 这是「用可控的框架复杂度换插件侧的零改动」的直接代价。");
push("");

push("## 3. 文件清单与职责");
push("");
push("| 类别 | 文件 | 行数 | 职责 |");
push("|---|---|---:|---|");
const DUTY = {
  "src/kernel/api/Command.ts": "Command/Action 接口 + 错误类型 + help 条目结构",
  "src/kernel/api/ShapeProvider.ts": "扩展点 1：图形类型的创建与读回契约",
  "src/kernel/api/AttributeHandler.ts": "扩展点 4：属性领域语义 + 事务接口",
  "src/kernel/api/TreeDecorator.ts": "扩展点 3：树行尾标签契约",
  "src/kernel/api/Plugin.ts": "插件上下文、事件总线、清单类型",
  "src/kernel/core/PluginHost.ts": "唯一装配入口：暂存注册、清单校验、去重、回滚",
  "src/kernel/core/ShapeRegistry.ts": "扩展点 1 注册表（类型名与读回标签双索引）",
  "src/kernel/core/CommandRegistry.ts": "扩展点 2 注册表 + 命令分发 + help 拼装",
  "src/kernel/core/DecoratorRegistry.ts": "扩展点 3 注册表（每会话一实例）",
  "src/kernel/core/AttributeRegistry.ts": "扩展点 4 注册表 + set 事务日志",
  "src/kernel/core/History.ts": "undo/redo 栈与 io 后禁用规则",
  "src/kernel/core/EditorContext.ts": "会话状态容器（文档、注册表、历史、事件）",
  "src/kernel/io/SvgParser.ts": "SVG 读入：按注册表决定元素归属与降级",
  "src/kernel/io/SvgSerializer.ts": "SVG 写出（含扩展属性）",
  "src/kernel/io/XmlParser.ts": "迷你 XML 解析器",
  "src/assembly/Editor.ts": "组合根：构造空壳编辑器",
  "src/assembly/PluginSet.ts": "装配方式 A：代码装配",
  "src/assembly/ConfigAssembly.ts": "装配方式 B：读配置装载",
  "src/assembly/PluginLoader.ts": "按模块名解析/求值 + 四类失败判定",
  "src/plugins/stats/index.ts": "命令插件：图形统计",
  "src/plugins/dir/index.ts": "命令插件：目录查看（经适配器）",
  "src/plugins/shape-box/boxProvider.ts": "图形插件：box 的创建与读回",
  "src/plugins/shape-box/BoxAttributeHandler.ts": "属性插件：box 的 fill/label 语义",
  "src/plugins/shape-box/BoxTypeLabel.ts": "树标签插件：(box) 标注",
  "src/plugins/tree-star/ModifiedStar.ts": "树标签插件：未保存修改的 *",
  "src/kernel/model/Shape.ts": "图形基类（Composite 的 Component）+ 属性封装 + 扩展属性槽",
  "src/kernel/model/Group.ts": "容器（Composite）+ 深度优先遍历",
  "src/kernel/model/SvgDocument.ts": "画布 + 根容器 + id 索引（唯一性在此强制）",
  "src/kernel/model/Rect.ts": "矩形",
  "src/kernel/model/Circle.ts": "圆",
  "src/kernel/model/Ellipse.ts": "椭圆",
  "src/kernel/model/Line.ts": "线段",
  "src/kernel/model/TextShape.ts": "文本（内容为子文本）",
  "src/kernel/model/Format.ts": "数字格式化与字面量校验",
  "src/cli/Repl.ts": "REPL：分词后交给注册表分发，不认识任何具体命令",
  "src/cli/main.ts": "入口：解析 --config/--no-plugins，选择装配方式",
  "src/cli/tokenize.ts": "命令行分词（双引号包裹）",
  "src/plugins/shape-box/BoxShape.ts": "box 容器类：子部件锁定与类型标注",
  "src/plugins/shape-box/index.ts": "box 插件装配（图形 + 属性 + 标签三类注册）",
  "src/plugins/tree-star/index.ts": "star 插件装配",
};

for (const b of ["kernel", "assembly", "plugin"]) {
  for (const f of head.buckets[b].sort((x, y) => (x.file < y.file ? -1 : 1))) {
    push(`| ${b} | \`${f.file}\` | ${f.lines} | ${DUTY[f.file] ?? ""} |`);
  }
}
push("");

push("## 4. VSCode 扩展（不计入 CLI 增量）");
push("");
if (head.buckets.vscode.length === 0) {
  push("（本次未纳入统计：`vscode-extension/` 为独立 TypeScript 工程）");
} else {
  push("| 文件 | 行数 | 职责 |");
  push("|---|---:|---|");
  for (const f of head.buckets.vscode) {
    const duty =
      f.file.endsWith("outline.ts")
        ? "SVG 文本 → 大纲节点的纯函数（可单测）"
        : f.file.endsWith("providers.ts")
        ? "VSCode provider：文件装饰 + 文档符号"
        : f.file.endsWith("extension.ts")
        ? "activate：注册两个 provider"
        : "";
    push(`| \`${f.file}\` | ${f.lines} | ${duty} |`);
  }
  push("");
  push(`小计：${head.lines.vscode} 行，圈复杂度 ${head.complexByBucket.vscode}。`);
}
push("");

const outDir = path.join(ROOT, "docs", "metrics");
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "README.md"), rows.join("\n") + "\n", "utf8");
console.log(rows.join("\n"));
