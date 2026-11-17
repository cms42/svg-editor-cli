# SVG 编辑器 — 架构文档（Phase 2：插件实践与插件式重构）

软件设计 PJ1。同一仓库由 Phase 1（tag `final`）演进到 Phase 2（tag `p2`）。
TypeScript + 面向对象，CLI 零运行时第三方依赖；VSCode 扩展是独立工程。

```bash
npm install && npm run cli          # 方式 A：代码装配
npm run cli -- --config plugins.config.json   # 方式 B：配置装配
npm run test                        # 单测 + Phase 1 回归 + 双装配一致性
npm run metrics                     # 重新生成 docs/metrics
cd vscode-extension && pnpm install && pnpm test
```

---

# 第一部分：VSCode 插件实践

## A.1 SVG 文件标记

`vscode-extension/src/providers.ts` 的 `SvgBadgeProvider` 实现
`vscode.FileDecorationProvider`，对 path 以 `.svg` 结尾的 URI 返回
`{ badge: "[]", tooltip: "SVG document" }`：

```ts
provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
  if (!uri.path.toLowerCase().endsWith(".svg")) return undefined;
  return { badge: "[]", tooltip: "SVG document" };
}
```

标记是 Explorer 的**装饰信息**：文件名不变、文件内容不变，非 SVG 文件与目录返回
`undefined` 因此没有任何标记。

实机验证（`code --extensionDevelopmentPath=... --new-window examples`）：

![SVG 文件标记](images/vscode-svg-badge.jpg)

`flowchart.svg` 右侧显示 `[]`，同目录的 `notes.txt` 没有标记，文件名仍是 `flowchart.svg`。

## A.2 SVG 大纲

`SvgDocumentSymbolProvider` 实现 `vscode.DocumentSymbolProvider`，把
`buildOutline(document.getText())` 的结果映射成 `vscode.DocumentSymbol` 树：

- 有 id 时标签为 `标签#id`，无 id 时只显示标签名；
- `selectionRange` 只覆盖起始标签所在行，点击大纲即跳到该行；
- 编辑过程中 XML 不完整（缺少闭合标签、未闭合引号、半个标签名）时返回空数组，
  大纲暂时清空但扩展不抛错。

![SVG 大纲](images/vscode-svg-outline.jpg)

左下大纲展示 `svg → g#flow → {rect#start, text, line#edge, g#node2}`，
`text`（第 5 行无 id 的元素）只显示标签名。

## A.3 职责边界与模式分析

### VSCode 与扩展各自的职责

| 环节 | 由谁负责 |
|---|---|
| 决定何时解析（打开文件、编辑、切换标签、首次激活） | VSCode |
| 调用 `provideDocumentSymbols` / `provideFileDecoration` | VSCode |
| 把 Symbol 树渲染成大纲、处理点击跳转 | VSCode |
| 绘制文件装饰、合并多个 provider 的装饰 | VSCode |
| SVG 文本 → 元素层级；后缀 → 装饰 | 扩展 |
| 发现 `.svg` 关联到 `svg` 语言 | VSCode（读 `contributes.languages`） |

注册过程是单向的：`activate()` 调用
`vscode.languages.registerDocumentSymbolProvider` 与
`vscode.window.registerFileDecorationProvider`，把对象交给 VSCode 的注册表；
此后一切调用都由 VSCode 发起。扩展无法主动"往大纲里写一行"，
只能应答 VSCode 的问题。这与 CLI 侧的 `PluginContext.register*` 是同一个模式：
**宿主持有注册表，插件只做注册**。

### 文件装饰 vs 经典 Decorator vs 适配器

| 维度 | 经典 Decorator（GoF） | VSCode 文件装饰 | 适配器 Adapter |
|---|---|---|---|
| 被包装的是什么 | 一个对象（同一接口的兄弟） | 一个 URI 的**表现**，不包装对象 | 一个已有接口，转成目标接口 |
| 调用方向 | 外层调用内层 → 层层转发叠加 | VSCode 聚合多个 provider 的返回值 | 调用方只认识 Target |
| 是否要求同接口 | 是（`Shape` 与 `Group` 同接口） | 否，`FileDecoration` 是值对象 | 否，`Target` 是新定义的 |
| 状态归属 | 装饰者自己持有附加状态 | 无状态，纯函数式映射 | 被适配者持有 |

VSCode 的装饰机制形似 Decorator：多个 provider 的结果被**叠加**成最终表现，
且每个只关心"给它加什么"。但三点关键差异使它不属于经典 Decorator：

1. **不包装对象**。经典 Decorator 持有一个同接口的组件引用并转发调用；
   `provideFileDecoration` 直接返回一个值对象，没有"内层组件"。
2. **不在调用链上**。经典 Decorator 是嵌套调用，层层剥洋葱；
   这里是 VSCode 把 N 个 provider 的返回值**收集后合并**，provider 之间互不感知。
3. **多重性由宿主决定**。谁被装饰、装饰几次由 VSCode 的注册表决定，
   而不是由构造时的包装顺序决定。

它更接近**策略 + 注册表**（VSCode 持有策略列表，按需取用返回值），
在"扩展点"这个意义上与 GoF 的 Decorator 同源：都是"不改主体、从外部追加表现"。
真正用到适配器的是 CLI 侧的 `dir`：`DirectoryReader` 是 Target，
`FsDirectoryReader` 把 `fs.readdirSync` 适配成这个接口（见第三部分 §5）。

### Phase 1 代码的复用评估

| 模块 | 能否复用 | 结论与原因 |
|---|---|---|
| `kernel/io/XmlParser.ts` 的解析逻辑 | **可复用（已复用）** | 纯函数、无 IO、无领域知识。VSCode 侧需要"不依赖 tsconfig 输出目录"的独立实现，因此 `outline.ts` 重写了一份更宽松的实现（它必须容忍不完整输入，而 CLI 解析器必须严格报错）。两者**语义不同**，故不是复制粘贴，而是各自满足不同契约。 |
| `kernel/model/*` 图形类 | 不可复用 | 图形类服务于编辑语义（move/scale/唯一 id/序列化），VSCode 大纲只需要"标签名 + id + 源码偏移"，套用模型会带入大量无用的不变量与错误分支。 |
| `SvgParser`（读入并补 id） | 不可复用 | 它遇到不完整 XML 会整份拒绝（编辑器语义：不能读进半个文档）；大纲必须容忍半截输入并给出部分结构，两者错误策略相反。 |
| `TreeAction` 的树渲染与对齐 | 不可复用 | 它输出的是**文本**布局（前缀字符 + 属性列对齐），VSCode 要的是 `DocumentSymbol` 树，由 VSCode 自己排版。可复用的只有"如何遍历子树"这个思路。 |
| `SvgSerializer` | 不可复用 | 扩展不改文件内容。 |
| `kernel/api/TreeDecorator` 契约 | 概念可复用 | "行尾追加标签"与"Symbol 上追加 detail"是同一类扩展点，但接口类型 `vscode.DocumentSymbol` 与内核的 `Shape` 无关，强行统一会污染内核。 |

结论：**真正能复用的是"纯函数 + 显式契约"的写法，而不是具体代码**。
Phase 1 把 XML 解析写成无副作用函数、把模型层与 IO 分离，使得 VSCode 侧可以
照同样的分层写一份 148 行的独立实现，而不必把 CLI 的模型搬进扩展。

---

# 第二部分：CLI 插件式重构

## 1. 模块划分

```
src/
├── kernel/                 ← 内核：只定义契约与骨架，不含任何具体图形/命令
│   ├── api/                四个扩展点接口 + Command/Action + 插件上下文与清单类型
│   │   ├── Command.ts          Command / Action / CommandError / CommandHelp
│   │   ├── ShapeProvider.ts    扩展点 1（图形类型）
│   │   ├── AttributeHandler.ts 扩展点 4（属性语义）+ AttributeTransaction
│   │   ├── TreeDecorator.ts    扩展点 3（树标签）
│   │   └── Plugin.ts           PluginContext / PluginManifest / EditorEvents / EditorServices
│   ├── core/               注册表与装配入口
│   │   ├── ShapeRegistry.ts     扩展点 1 注册表（类型名 + 读回标签双索引）
│   │   ├── CommandRegistry.ts   扩展点 2 注册表 + 分发 + help 拼装
│   │   ├── DecoratorRegistry.ts 扩展点 3 注册表（每会话一实例）
│   │   ├── AttributeRegistry.ts 扩展点 4 注册表 + SetTransaction
│   │   ├── PluginHost.ts        唯一装配入口（暂存 → 校验 → 去重 → 提交/回滚）
│   │   ├── History.ts           undo/redo 栈
│   │   └── EditorContext.ts     会话状态容器
│   ├── io/                 XmlParser / SvgParser（按注册表归属）/ SvgSerializer
│   └── model/              Shape 继承体系 + SvgDocument
├── builtin/                ← 内置插件：Phase 1 的六种图形与全部命令
│   ├── shapes/providers.ts     六个 ShapeProvider 实例
│   ├── commands/               各命令一类一文件
│   └── index.ts                内置插件的 activate（注册图形 + 命令 + help）
├── plugins/                ← 可选插件（各自独立，互不依赖）
│   ├── stats/                  命令插件：图形统计
│   ├── dir/                    命令插件：目录查看（含 DirectoryReader 适配器）
│   ├── shape-box/              图形 + 属性 + 标签三类扩展
│   ├── tree-star/              树标签：未保存修改
│   └── shape-diamond/          拓展任务：判断框
├── assembly/               ← 装配处：不属于内核，内核不 import 它
│   ├── Editor.ts               createEditor（空壳）
│   ├── PluginSet.ts            方式 A：代码装配
│   ├── ConfigAssembly.ts       方式 B：配置装配
│   └── PluginLoader.ts         按模块名解析/求值 + 四类失败判定
└── cli/                    ← REPL 与入口（分层器：只分词后交给注册表）
    ├── Repl.ts / tokenize.ts / main.ts
```

组件图（PlantUML，重构后）：

```plantuml
@startuml
skinparam packageStyle rectangle

package "kernel（内核，不认识任何具体插件）" {
  package "api" {
    interface ShapeProvider
    interface Command
    interface AttributeHandler
    interface TreeDecorator
    interface PluginContext
  }
  package "core" {
    [PluginHost] as Host
    [ShapeRegistry] as ShapeReg
    [CommandRegistry] as CmdReg
    [AttributeRegistry] as AttrReg
    [DecoratorRegistry] as DecReg
    [EditorContext] as Ctx
  }
  package "io" {
    [SvgParser]
    [SvgSerializer]
  }
  package "model" {
    [Shape] as MShape
    [SvgDocument]
  }
}

package "builtin（内置插件）" {
  [BuiltinPlugin] as Builtin
  [6 个 ShapeProvider] as SixShapes
}

package "plugins（可选插件）" {
  [stats]
  [dir]
  [shape-box]
  [tree-star]
  [shape-diamond]
}

package "assembly（装配处）" {
  [Editor.createEditor]
  [PluginSet  A]
  [ConfigAssembly  B]
  [PluginLoader]
}

package "cli" {
  [Repl]
  [main]
}

PluginContext -up-> Host : 由 Host 创建
ShapeProvider <-up- ShapeReg
Command <-up- CmdReg
AttributeHandler <-up- AttrReg
TreeDecorator <-up- DecReg
ShapeReg -up-> SvgParser
Ctx *-- ShapeReg
Ctx *-- CmdReg
Ctx *-- AttrReg
Ctx *-- DecReg

Builtin ..|> PluginContext
SixShapes ..|> ShapeProvider
stats ..|> Command
dir ..|> Command
shape-box ..|> ShapeProvider
shape-box ..|> AttributeHandler
shape-box ..|> TreeDecorator
tree-star ..|> TreeDecorator
shape-diamond ..|> ShapeProvider

main --> PluginSet : 方式 A
main --> ConfigAssembly : 方式 B
PluginSet ..> Host
ConfigAssembly ..> PluginLoader
ConfigAssembly ..> Host
Repl --> CmdReg
@enduml
```

## 2. 扩展点清单

四个扩展点的接口都在 `src/kernel/api/`，内核只依赖接口。下表逐项对应代码位置。

### 2.1 `ShapeProvider` — 一种图形类型

| 项 | 内容 |
|---|---|
| 接口 | `kernel/api/ShapeProvider.ts` 的 `ShapeProvider` |
| 职责 | 声明类型名与 create 参数 schema；把参数解析为 `ShapeSpec`；构造 `Shape`（可生成任意子树）；读回时接管自己的元素 |
| 内核调用位置 | `kernel/core/ShapeRegistry.ts:parse()`（`builtin/commands/CreateCommand.ts:37,47` 调用）、`ShapeRegistry.ts:create()`（`CreateCommand.ts:79`）、`kernel/io/SvgParser.ts` 的 `build()`（`shapes.get(kind)` / `shapes.providerForTag(tag)`） |
| 已有实现 | `builtin/shapes/providers.ts`（rect / circle / ellipse / line / text / g）、`plugins/shape-box/boxProvider.ts`、`plugins/shape-diamond/index.ts` |
| 缺省行为 | 未装载某类型时 `create <type>` 报 `error: unknown shape type: <type> (is the plugin loaded?)`；读回遇到未注册的标签名报 `warning: ignoring unsupported element <png>` 并跳过 |
| 违反契约 | `parse` 抛 `ModelError("wrong number of arguments")` 由 CreateCommand 转成 usage 提示；`create` 抛 `ModelError` 报 `error: id already exists: …`；`fromNode` 抛 `ShapeReadError` → 整份读入失败、原文档保持不变 |
| 插件名 | 即 `type`（`contributes.shapes`） |

### 2.2 `Command` — 一条可用命令

| 项 | 内容 |
|---|---|
| 接口 | `kernel/api/Command.ts` 的 `Command`（可 undo）/ `Action`（不可 undo）+ `Plugin.ts` 的 `CommandFactory` |
| 职责 | 把一次输入变成一个原子操作；可 undo 的返回 `execute/undo` 两个回显行数组，不可 undo 的返回 `run` |
| 内核调用位置 | `kernel/core/CommandRegistry.ts:dispatch()`（`cli/Repl.ts:handleLine` 调用）；`helpLines()` 拼装 help |
| 已有实现 | `builtin/commands/*.ts` 全部 Phase 1 命令、`plugins/stats/index.ts`、`plugins/dir/index.ts` |
| 缺省行为 | 未装载时报 `error: unknown command: <name>`；`--no-plugins` 时空壳编辑器连 `init` 都没有 |
| 违反契约 | 构造或执行抛 `CommandError` → `error: <message>`，状态不变（构造函数里做全部校验，失败即不入栈） |
| 插件名 | 命令名（`contributes.commands`） |

### 2.3 `TreeDecorator` — 结构树行尾标签

| 项 | 内容 |
|---|---|
| 接口 | `kernel/api/TreeDecorator.ts` 的 `TreeDecorator`（`decorate(row) → string \| null`）+ `TreeDecoratorFactory` |
| 职责 | 给定一行（根行或某个 `Shape`），返回要追加在行尾的标签 |
| 内核调用位置 | `kernel/core/DecoratorRegistry.ts:all()`，被 `builtin/commands/actions/TreeAction.ts:run()` 的 `collectTags()` 逐行调用；拼接在 `joinTags()` |
| 已有实现 | `plugins/shape-box/BoxTypeLabel.ts`（`(box)`）、`plugins/tree-star/ModifiedStar.ts`（`*`） |
| 缺省行为 | 无任何 decorator 时 `tree` 输出与 Phase 1 **逐字节相同**（`tests/run.sh` 每轮验证） |
| 违反契约 | 返回 `null`/`""` 视为"本行无标签"；抛错会冒泡到 REPL 变成 `error:`（标签不应抛错；测试覆盖根行为） |
| 插件名 | `contributes.decorators` 里的名字 |

### 2.4 `AttributeHandler` — 某属性在某图形上的语义

| 项 | 内容 |
|---|---|
| 接口 | `kernel/api/AttributeHandler.ts` 的 `AttributeHandler`（`handles` / `apply`）+ `AttributeTransaction` |
| 职责 | 判定"我是否负责这个图形的这个属性"，若负责则执行修改（可改多个子部件），并通过事务记录旧值 |
| 内核调用位置 | `kernel/core/AttributeRegistry.ts:find()`（`builtin/commands/SetCommand.ts:38`）、`SetTransaction`（`SetCommand` 的 `execute`/`undo`） |
| 已有实现 | `plugins/shape-box/BoxAttributeHandler.ts`（box 的 `fill` 与 `label`） |
| 缺省行为 | 无 handler 命中时回落 Phase 1 白名单：`Shape.set` 允许则改，否则 `error: unknown attribute: <attr>` |
| 违反契约 | `handles` 抛错 → `error:`；`apply` 抛错 → **先回滚已写入属性**再报错，`History` 不入栈，文档与 undo/redo 历史都停在命令执行前（`tests/box.test.cjs` 的"处理器部分修改后抛错"用例） |
| 插件名 | `contributes.attributes` 里的名字 |

### 2.5 注册路径统一

四个扩展点的注册都只经过 `PluginHost.activate()` 创建的 `PluginContext`：

```ts
// kernel/core/PluginHost.ts:102-121
registerShape: (provider) => stage("shapes", provider.type, () => ctx.shapes.register(provider)),
registerCommand: (name, factory, help) => stage("commands", name, () => ctx.commands.register(...)),
registerHelp: (section, line) => stage("commands", "\u0000help:" + line, () => ...),
registerDecorator: (name, factory) => stage("decorators", name, () => ctx.decorators.register(...)),
registerAttributeHandler: (handler) => stage("attributes", handler.name, () => ctx.attributes.register(handler)),
```

`stage()` 只把注册放进暂存数组；`activate` 末尾依次做清单校验（`checkManifest`）、
重名检查（`checkDuplicates`），全部通过才逐条 `commit()`。任何一步失败，暂存数组直接丢弃，
内核注册表**一个字节都没被改**。

## 3. 两种装配方式

### 3.1 方式 A：代码装配（组合根）

`src/assembly/PluginSet.ts`：

```ts
export function codeAssembly(editor: Editor): void {
  editor.host.activate(builtinPlugin);   // Phase 1 等价能力
  editor.host.activate(boxPlugin);       // ShapeProvider + AttributeHandler + TreeDecorator
  editor.host.activate(starPlugin);      // TreeDecorator
  editor.host.activate(statsPlugin);     // Command
  editor.host.activate(dirPlugin);       // Command（经适配器访问文件系统）
}
```

新增插件 = 加一行 + 重新构建。类型检查完整、调试直接。

### 3.2 方式 B：配置装配

`plugins.config.json`（仓库根）：

```json
{
  "plugins": [
    { "module": "./dist/plugins/shape-box/index.js" },
    { "module": "./dist/plugins/tree-star/index.js" },
    { "module": "./dist/plugins/stats/index.js" },
    { "module": "./dist/plugins/dir/index.js" },
    { "module": "./dist/plugins/shape-diamond/index.js", "options": { "fill": "#f5a623" } }
  ]
}
```

字段含义：

| 字段 | 说明 |
|---|---|
| `module` | 插件模块名。以 `./` `../` 开头或绝对路径时以**配置文件所在目录**为基准；否则按 Node 模块解析规则（包名、子路径、`node_modules`） |
| `options` | 原样透传给插件的 `PluginContext.options`，缺省 `{}` |
| `enabled` | `false` 时**完全跳过**（不加载、不求值）；缺省视为启用 |

装载规则（`assembly/ConfigAssembly.ts` + `PluginLoader.ts`）：

1. 读文件并 JSON 解析；语法错误或结构不合法 → `error: invalid plugin config`，
   **不装任何可选插件**（内置插件仍装，保证默认能力）。
2. 按数组顺序逐项装载；每项独立成败，失败只打印一行并继续。
3. 内置插件由装配处先装（不写在配置里），因此基础能力永远可用。

加载器的独立性：`PluginLoader.ts` 里没有插件名、没有名称映射表、没有按类别的分支，
只有 `resolve()` → `import()` → 取默认导出。接入新插件不需要改这个文件。

### 3.3 加载器的四类失败

| 失败 | 判定位置 | 输出 |
|---|---|---|
| 模块找不到 | `PluginLoader.ts` 的 `requireFromConfig.resolve` 抛错 | `error: plugin not found: <module>` |
| 没有默认导出 | `unwrapDefault()` 结果不是带 `activate` 的对象 | `error: plugin has no default export: <module>` |
| 清单声明与实际注册不一致 | `PluginHost.checkManifest` 逐类别比较声明集合与实际注册集合 | `error: plugin manifest mismatch: <name> (commands: declared but not registered [bar])` |
| `activate` 抛错（含模块求值失败） | `PluginHost.activate` 的 try/catch、`PluginLoader` 的 import try/catch | `error: plugin failed to activate: <name> (<reason>)` |
| 同类注册名重复 | `PluginHost.checkDuplicates` | `error: duplicate registration: <category>/<name>` |

"模块存在但求值失败"与"模块找不到"被严格区分：前者走 `import()` 的 catch，
后者走 `resolve()` 的 catch。这条区分有专门测试（`tests/kernel.test.cjs`
的"模块求值失败不得误报为找不到"）。

### 3.4 双装配一致性与差异判据

```bash
bash tests/dual-assembly.sh
```

三条会话（Phase 1 §6 典型会话、§6.1 的 box 会话、含 `stats`/`dir` 的新增命令会话）
分别在 A、B 两种装配下执行，**输出逐字节相同**；同一脚本还把"禁用新增插件"时的
输出与 `tests/expected_main.txt`（Phase 1 提交时的逐字节快照）比较。

#### 方式 A 的差异判据（分支 `demo-assembly-a`）

接入新插件的那次提交：

```bash
git show --name-status --format="%s" demo-assembly-a
# demo(assembly-a): diamond 经代码装配接入
# M	src/assembly/PluginSet.ts
```

只改了一个顶层装配文件（`src/assembly/PluginSet.ts` 加一行 `activate`），
其余按任务书的排除法验证内核与既有插件差异为空：

```bash
git diff demo-assembly-a^ demo-assembly-a --name-status -- \
  src/kernel src/builtin src/plugins/stats src/plugins/dir \
  src/plugins/shape-box src/plugins/tree-star
# → 无输出
```

分支上实跑确认生效：

```text
svg> create diamond d1 100 50 80 40
diamond#d1 created
svg> tree
svg (200x100) *
└── polygon#d1  points=100,30 140,50 100,70 60,50 fill=#f5a623 *
```

该分支是**演示分支**，不合并进 `main`（`main` 里 diamond 走的是配置装配）。

#### 方式 B 的差异判据（`main` 的 `31c71cd`）

`main` 上接入 `diamond` 的提交 `31c71cd`：

```bash
git show --name-status -M --format="" 31c71cd
```

输出只有五类行，逐项可核：

```
M   package.json                                                  # 依赖元数据
A   plugins.config.json                                           # 方式 B 的配置
R100 src/io/XmlParser.ts → src/kernel/io/XmlParser.ts             # 纯改名，内容零变化
A   src/plugins/shape-diamond/{index.ts,PolygonShape.ts,package.json}
D   src/{model,io,command}/…                                      # Phase 1 旧目录清理（15 个）
```

即：**内核与既有插件（builtin / stats / dir / shape-box / tree-star）没有任何
内容修改**（没有 `M` 行）。`R100` 表示相似度 100% 的纯改名，
用 `git diff 31c71cd^:src/io/XmlParser.ts 31c71cd:src/kernel/io/XmlParser.ts` 可验证为空 diff。

若按任务书的路径过滤方式执行：

```bash
git diff -M 31c71cd^ 31c71cd --name-status -- src/kernel src/builtin \
  src/plugins/stats src/plugins/dir src/plugins/shape-box src/plugins/tree-star \
  ':(exclude)src/plugins/shape-diamond'
# → A  src/kernel/io/XmlParser.ts
```

这一行是上一条 `R100` 的**一半**：改名目标在过滤范围内、源文件在范围外，
Git 无法配对所以显示为 `A`。用 `git show -M`（不过滤路径）就能看到它是改名。
另需注意任务书提醒的陷阱：路径写错时 Git 返回空结果，**空输出本身不能作为通过依据**，
所以要同时确认路径存在、并核对文件内容确实未变。

## 4. ADR

### ADR-1：属性扩展点的契约——单处理器 + 事务日志 + 失败回滚

**问题**：`AttributeHandler` 只写了 `handles` 与 `apply`，没有说明"多个处理器命中怎么办"、
"handler 怎么改子部件"、"改多个部件怎么保持一个 undo 单元"、"改一半抛错怎么办"。

**决定**：

1. **访问方式**：handler 拿到的 `shape` 与 `tx` 都来自内核。取子部件只能走公开访问器
   （`box.boxRect` / `box.boxLabel` 或 `children`），不能用 `as any` 摸私有字段。
   字段封装保持不变；需要领域语义的图形在自己的类里暴露只读访问器。
2. **多处理器冲突**：**先注册者优先，不做组合执行**。`AttributeRegistry.find()`
   按注册顺序返回第一个命中者，之后不再询问其他 handler。理由：组合执行会让
   "set 一次"的语义取决于插件装载顺序的乘积效应，不可预测；
   需要多步修改时，应由**一个** handler 内部完成（像 box 的 `fill` 那样）。
   这条规则有测试：同一 box 上先后注册两个都命中的 handler，只有先注册者生效。
3. **一次 set 一个 undo 单元**：所有写入都必须经 `tx.set(shape, attr, value)`，
   它把 `{shape, attr, oldValue}` 记入日志。`SetCommand` 持有一个 `SetTransaction`，
   `undo()` 逆序 `rollback()`。因此 handler 改 1 个还是 5 个子部件，都只对应 1 条 undo 记录。
   `redo` 前调用 `tx.reset()` 重新执行 `apply`，而不是复用上次结果——保证文档真的被改回去。
4. **部分修改后抛错**：`SetCommand.execute()` 的 catch 里先 `tx.rollback()` 再抛，
   `History` 不入栈。因此文档内容、undo 栈、redo 栈三者都停在执行前。
   测试用例注入一个"改完两个属性再抛错"的 handler，验证三件事：两个属性都还原、
   `undo` 撤回的是更早的 `create`、`redo` 栈未被清空。

**代价**：handler 必须自律地只用 `tx` 写，绕过 `tx` 直接调 `shape.set` 就失去回滚能力。
这一点无法用类型系统强制（`Shape.set` 是公开方法），只能靠接口文档与代码审查；
`SetCommand` 的注释里写明了这条纪律。

### ADR-2：box 的读回降级与不完整结构

**问题**：装了 box 插件但文件里的 `data-kind="box"` 元素结构不对（少子部件、子部件类型错、
子部件 id 与文档已有 id 冲突）时，应该拒绝整份读入、还是警告后降级为普通 `g`？

**决定**：**结构不合法就拒绝整份读入**；只有"根本没装插件"时才降级。

| 场景 | 行为 | 理由 |
|---|---|---|
| 装了插件，`data-kind="box"` 但子元素不是恰好 `rect`+`text` | `error: cannot parse <file>: box x must have exactly 2 children, got 1`，原文档不变 | 生成残缺 box 会让后续 `set n1 fill` 之类的语义无处落地，错误会在很远的地方才爆发 |
| 装了插件，子部件 id 与已有 id 冲突 | `error: cannot parse …: duplicate id: n1-rect` | 全局 id 唯一性是内核的硬不变量，不能靠改名消除（改名会让引用失效） |
| **没装**插件，遇到 `data-kind="box"` | `warning: unsupported kind box, degraded <g> to plain element`，按普通 `g` 读入 | 降级后功能不损（还能 move/scale/tree/save），只是失去 box 的领域语义 |
| 没装插件，遇到完全不认识的标签（如 `polygon`） | `warning: ignoring unsupported element <polygon>`，跳过 | Phase 1 既有行为 |

**代价**：读入一个含坏 box 的文件会整体失败，用户可能更希望"能读多少读多少"。
选择严格是因为**读入是原子操作**（`ReadAction` 成功才替换 `ctx.doc`），
部分成功会让文档处于"读者以为完整、实际缺内容"的状态，比直接失败更难排查。

### ADR-3：dirty 语义与祖先传播

**问题**：`modified-star` 的 `*` 该按什么判 dirty？子图形改了，祖先容器行要不要标？

**决定**：

1. **按内容比对**，不按"发生过编辑命令"。标签在 `document-opened` / `document-saved`
   时对全树拍快照（`id → 自身签名`，签名 = 类型 + 属性表 + 文本，**不含子节点**），
   渲染时逐行比较。
   - 直接后果：`undo` 回到保存点后 `*` 自然消失，不需要命令层配合，
     也不需要"编辑命令要通知标签"这种横切依赖。
   - 另一后果：保存点之后新建的节点（基线里没有这个 id）一律带 `*`。
2. **祖先不传播**。子图形改了只有它自己带 `*`，容器行不替子孙背锅。
   理由：树的价值在于"哪一行变脏了"，把祖先也标脏会让长文档里几乎每行都有星号。
   唯一的例外是根行 `svg (WxH) *`：它表示"整份文档有未保存修改"，
   属于文档级标记（计算方式是子树任一脏），不是祖先传播。
3. **一行多标签按注册顺序拼接，用单个空格分隔**。`tree` 的渲染器只做
   `tags.join(" ")`，不关心标签是谁给的。同一行同时有 `(box)` 与 `*` 时，
   顺序取决于插件装载顺序，这一点有测试（两种装载顺序得到 `(box) *` 与 `* (box)`）。

**代价**：内容比对需要每次 `tree` 时对全树算签名，O(节点数)。在几千节点的图上，
`tree` 是显示类命令、不进 undo 栈、也不在热路径，这个开销可接受；
如果未来出现超大文档，可以按 id 缓存签名并只在 `document-edited` 时失效。

### ADR-4：配置清单的校验时机

**问题**：`contributes` 的校验放在"求值后立即"还是"实际注册时"？

**决定**：**在 activate 期间用暂存区校验，通过后才提交**。

流程（`PluginHost.activate`）：

```
plugin.activate(context)   → 所有 register* 只写暂存数组
   ├─ 抛错？    → discarded，error: plugin failed to activate
   ├─ 清单不符？ → discarded，error: plugin manifest mismatch（列出类别与双向差异）
   ├─ 重名？    → discarded，error: duplicate registration: <category>/<name>
   └─ 全通过    → 逐条 commit()
```

为什么不是"先提交再校验"：那会留下半装状态，需要写补偿逻辑（撤销已提交的注册），
而补偿本身可能失败。暂存区把"安装"变成一个**要么全装要么全不装**的原子操作。

为什么不是"校验后再 activate"：`contributes` 声明的是**实际注册了什么**，
只能在 activate 跑完之后才知道；声明与实现的偏差正是要抓的东西。

清单来源：以插件包自己的 `package.json` 的 `contributes` 为准，模块自身的同构字段
作为补充（两者合并取并集）。代码装配路径用模块自带的 `contributes`，
配置装配路径从 `package.json` 读——两条路径走同一个 `checkManifest`。

## 5. `dir` 的目录访问接口与适配器模式

### 角色对应

| 适配器模式角色 | 本实现 | 说明 |
|---|---|---|
| **Target**（客户期望的接口） | `plugins/dir/DirectoryReader.ts` 的 `DirectoryReader` | `list(path): DirectoryEntry[]`，命令逻辑只认识它 |
| **Adaptee**（已有接口，不兼容） | Node 的 `fs.readdirSync(path, {withFileTypes:true})` | 返回 `Dirent[]`，含 `.` `..`，异常是 `Error` 不带路径语义 |
| **Adapter**（适配者） | `plugins/dir/FsDirectoryReader.ts` 的 `FsDirectoryReader` | 调用 `fs.readdirSync`，过滤 `.` `..`，把 `Dirent` 折成 `DirectoryEntry`，把异常转成 `DirectoryReadError(path)` |
| **Client**（使用 Target 的一方） | `plugins/dir/index.ts` 的 `DirAction` | 只调用 `reader.list(cwd)`，不认识 `fs` |

```ts
// Target
export interface DirectoryReader {
  list(path: string): DirectoryEntry[];
}

// Adapter
export class FsDirectoryReader implements DirectoryReader {
  list(path: string): DirectoryEntry[] {
    let dirents: fs.Dirent[];
    try { dirents = fs.readdirSync(path, { withFileTypes: true }); }
    catch { throw new DirectoryReadError(path); }
    return dirents.filter(d => d.name !== "." && d.name !== "..")
                  .map(d => ({ name: d.name, isDirectory: d.isDirectory() }));
  }
}
```

`DirAction` 的构造函数接收 `DirectoryReader` 与 `cwd`，
装配时由插件默认注入 `new FsDirectoryReader()`，测试时通过 `options.reader` 注入替身：

```ts
// tests/dir.test.cjs
class StubReader { list(p) { if (this.fail) throw new DirectoryReadError(p); return this.entries; } }
```

渲染逻辑独立成纯函数 `renderDirectoryListing(entries)`（`plugins/dir/format.ts`），
排序（目录在前、文件在后、各组按码位升序）与"空目录输出 `(empty directory)`"都在这里，
与文件系统完全解耦。

### 行为约定

- 工作目录是**启动进程时的 `process.cwd()`**，`read`/`save` 不改变它；
- 只列直接子项，不递归；含隐藏项，不含 `.`/`..`；
- 每项一行，`[DIR]  ` / `[FILE] `（标记后两个空格）；
- 符号链接按 `Dirent.isDirectory()` 报告（不跟随目标）；
- 读取失败输出 `error: cannot read directory: <path>`，之后仍可执行其他命令；
- 不依赖 SVG 文档，未 `init`/`read` 也能用；不改变文档、dirty 状态或 undo/redo 历史。

## 6. 依赖方向规则

```
kernel/api      ← 不依赖任何其它模块（只有类型）
kernel/model    ← 只依赖 kernel/api 的类型
kernel/core     ← 依赖 kernel/api + kernel/model
kernel/io       ← 依赖 kernel/api + kernel/model + kernel/core（只用只读查表）
builtin         ← 依赖 kernel/api + kernel/model（不依赖 kernel/core、assembly）
plugins/*       ← 依赖 kernel/api + kernel/model（不依赖 kernel/core、assembly）
assembly        ← 依赖 kernel/* + builtin + plugins（**唯一**可以认识所有插件的地方）
cli             ← 依赖 kernel/core + assembly
```

规则与理由：

1. **`kernel` 不 import `assembly`、`builtin`、`plugins`**。内核若认识具体插件，
   新增插件就必须改内核，OCP 立刻失效。检查方式：
   `rg "from \"\.\./(assembly|builtin|plugins)" src/kernel` 必须为空。
2. **`plugins/*` 不 import `kernel/core`**。插件只能通过 `PluginContext` 拿能力；
   直接 import 注册表就能绕过暂存与清单校验。检查方式：
   `rg "kernel/core" src/plugins` 必须为空（`stats` 里用了 `EditorContext` 的**类型**，
   属于 `import type`，运行时无依赖）。
3. **`plugins/*` 互不依赖**。任一插件都可以单独装载（`tests/box.test.cjs`
   的"box 插件可单独装在空内核上"）。`(box)` 与 `*` 的协作只发生在渲染器一侧，
   两个标签互不感知。
4. **`assembly` 是唯一的分叉点**。`cli/main.ts` 只决定"走 A 还是走 B"，
   之后完全一致。

## 7. 变化点假设

| 变化点 | 为它留了什么 | 或为什么决定不留 |
|---|---|---|
| **新增图形类型**（最可能与最频繁） | `ShapeProvider`。插件里写一个 provider，`registerShape` 一行。`diamond` 就是这条路径的实测：0 行内核改动 | — |
| **新增命令** | `Command` + `CommandFactory`。help 文案随命令一起注册，`HelpAction` 不用改 | — |
| **属性的领域语义**（如"给 box 设描边要同时改内部矩形"） | `AttributeHandler`。新语义不改 `set`，也不扩白名单 | — |
| **树上要看的附加信息**（行号、校验告警、协作占用） | `TreeDecorator`。渲染器只做拼接 | — |
| **区分 A/B 装配的装载策略** | 装载器只认 `module` 字符串与 `enabled`/`options` | 若未来要"按工作区条件启用"，会加一个 `when` 字段，仍不动装载器主流程 |
| **序列化格式变化**（加 metadata、换缩进） | 只改 `SvgSerializer`，是一处而非多处的 | 不留扩展点：格式是全局约定，按插件分化会让 round-trip 不可控 |
| **撤销粒度变成"命令组"** | `History` 是唯一入口，可加 `beginGroup/endGroup` | 本阶段不留：没有真实需求，过早抽象会污染 `Command` 接口 |
| **`dir` 换成远程/虚拟文件系统** | `DirectoryReader` 是接口，换实现即可 | — |
| **图形几何的表示方式**（如用 transform 代替直接改坐标） | 每个图形类自己实现 `move`/`scale`/序列化 | 不留统一"几何策略"扩展点：六种图形的几何差异很大，抽象出来只会得到一堆空方法 |
| **性能**（超大文档） | `tree` 每次算签名是 O(n)；`SvgDocument` 有 id 索引，查找是 O(1) | 不留缓存：现在没有实测瓶颈，加缓存会引入失效逻辑 |

---

# 第三部分：过程记录（与 AI 协作的关键迭代）

以下都是本次实际发生的问题与修正，不是示范性叙述。

## P1. 装饰器实例化时机不对，`*` 完全不出现

第一版 `DecoratorRegistry` 保存工厂、在首次 `tree` 时惰性实例化。
`ModifiedStar` 在构造函数里订阅 `document-opened` / `document-saved`，
于是 `init` 时标签还不存在，拿不到事件，基线永远是空 Map，
所有节点都被判为"保存点之后新建"，`*` 却应该出现的地方反而没了。
发现方式：写了 `init → create → tree` 的最小会话，期望根行带 `*`，实际没有。

修正：注册时就实例化（`register(name, factory)` 里直接 `factory()`）。
每个编辑器一套注册表，因此实例天然是"每会话一份"，不用模块级变量。
保留 `TreeDecoratorFactory` 类型是为了让那条"状态放实例字段"的约束在类型上可见。

## P2. `signature` 递归包含子节点，导致祖先被连带标脏

第二版签名是"属性 + 子孙签名"。子图形一改，容器的签名也变，
于是"子孙不传播"的设计实际没生效：`g#g1` 也跟着带 `*`。
发现方式：`tests/star.test.cjs` 的"祖先容器不替子孙背星号"用例直接失败。

修正：签名只含**自身**（类型 + 属性 + 文本），子孙脏由 `subtreeDirty` 逐层下钻发现；
根行的 `*` 单独用 `anyDirty`（任一子树脏）计算。这样"哪一行脏了"和
"整份文档有未保存修改"两件事各有各的判据。

## P3. `redo` 后属性没有真的改回来

第一版 `SetCommand` 在构造期调用 `handler.apply` 把结果缓存下来，`execute` 只回放缓存行。
这使 `redo` 只打印"已改"但文档没变。更隐蔽：`undo` 用构造期的日志回滚，
`redo` 又执行一次 `apply`，日志里出现两条同属性记录，`undo` 会回滚两次。

修正：`apply` 一律在 `execute` 里调用；`execute` 开头 `tx.reset()` 清日志。
现在 `set red → set blue → undo → redo` 的真实属性值分别是
red → blue → red → blue（测试用例"fill 两次 set 各自是一个 undo 单元"覆盖）。

## P4. `ConfigAssembly` 重复装载内置插件

第一版 `plugins.config.json` 里把内置插件也写成一项，而 `ConfigAssembly`
已经在开头 `activateBuiltin`。结果启动就打印
`error: duplicate registration: shapes/rect`，且 `init` 不可用。
发现方式：`tests/dual-assembly.sh` 的第一条用例（A/B 输出对比）直接暴露。

修正：**内置插件由装配处先装，配置只决定"额外"装哪些**。
这带来一个明确的口径：无论配置怎么写，Phase 1 的基础能力都在；
配置语法错误时 `error: invalid plugin config` 之后编辑器仍然可用（只是缺可选插件）。

## P5. 全局 `\.svg` 忽略规则把素材和示例吞掉

Phase 1 的 `.gitignore` 有 `*.svg`（避免提交 `save` 产物）与 `!examples/*.svg`。
本次新增 `doc/transcript/fixtures/other.svg` 与 `vscode-extension/examples/flowchart.svg`
都是**输入素材**而非产物，一开始被静默忽略——`git status` 里看不到，
`tests/dual-assembly.sh` 在干净克隆上会因缺文件而误通过（读不到文件只打印错误行，
两边的错误行还恰好相同）。

修正：`.gitignore` 补两条白名单 `!doc/transcript/fixtures/*.svg`、
`!vscode-extension/examples/*.svg`，并在脚本里断言素材存在、目录内容未被改动。
教训与任务书 §6 的提醒一致：**空 diff 本身不足以证明通过，先确认路径真的存在**。

## P6. 加载器把"求值失败"误报成"找不到"

第一版对 `import()` 与 `resolve()` 用了同一个 try/catch，
模块存在但 `throw` 在顶层时也打印 `plugin not found`。任务书明确要求区分这两件事
（"模块存在但求值或其依赖失败属于插件加载失败，不应误报为顶层模块找不到"）。

修正：拆成两段——`resolve()` 失败才是 not found，`import()` 失败走
`plugin failed to activate: <spec> (<reason>)`。并补了一条专门的测试。

## P7. VSCode 的 Image Preview 抢走 SVG 的打开方式

第一次实机验证时，点开 `flowchart.svg` 进的是内置 Image Preview，
大纲面板显示"The active editor cannot provide outline information"。
这不是扩展的问题：Image Preview 是自定义编辑器（custom editor），
不走 `DocumentSymbolProvider`。

修正：在 `vscode-extension/.vscode/settings.json` 里固定
`workbench.editorAssociations` 与 `files.associations`，
并用 "Reopen Editor With… → Text Editor" 验证，
大纲与点击定位都正常（见 A.2 的截图）。

## P8. 被自己写的测试抓到的一处真实 bug

`tests/box.test.cjs` 的"处理器部分修改后抛错"用例要求：注入的 handler
先改 fill、再改 text、然后抛错，三者都必须回滚。
第一版 `SetCommand` 在**构造期**调用 `apply`，所以异常发生在构造函数里，
`execute` 里的 `tx.rollback()` 从没执行过——fill 已经被改了。
这正好是 ADR-1 第 4 条要保证的东西，测试把它抓了出来。修正见 P3。

---

# 第四部分：一致性自查

## 1. 模块划分与方案是否一致

| 方案中的模块 | 实际目录 | 一致？ |
|---|---|---|
| kernel/api（四个扩展点接口） | `src/kernel/api/` 五个文件 | 一致 |
| kernel/core（注册表 + PluginHost + History） | `src/kernel/core/` 七个文件 | 一致 |
| kernel/io、kernel/model | `src/kernel/io/`、`src/kernel/model/` | 一致 |
| builtin（内置插件） | `src/builtin/` | 一致；`shapes/params.ts` 是新增的共享工具，未在方案中列出，已补记在此 |
| plugins（五个可选插件） | `src/plugins/{stats,dir,shape-box,tree-star,shape-diamond}/` | 一致；`shape-diamond` 是拓展任务，方案中列为"拓展任务（选做）" |
| assembly（装配处） | `src/assembly/` 四个文件 | 一致 |
| cli | `src/cli/` 三个文件 | 一致 |

不一致之处与修订：

1. **`src/builtin/shapes/params.ts`** 是六种图形 provider 共用的参数收拢函数，方案里
   没有单列。它属于插件内部实现细节，不影响分层，本文件已补记。
2. **`kernel/model/Shape.ts` 增加了三个协作位**：`displayTag`（回显类型名）、
   `isComposite()`（ungroup 拒绝的依据）、`lock()/detachVeto()`（子部件保护）。
   这三处是**为了让内核能表达"插件拥有的内部结构"** 而加的，
   设计原则是"语义放模型、决策权放插件"：内核只问"能不能摘"，不问"为什么不能"。
   对 Phase 1 的行为零影响（默认值全是"允许"）。
3. **`DecoratorRegistry` 从惰性实例化改为注册时实例化**（见 P1），
   方案里"工厂 + 每会话实例"的表述仍然成立，只是时机提前了。

## 2. 依赖方向有没有被违反

抽样检查（命令可复现）：

```bash
# 内核不得 import 装配处/插件
rg "from \"\.\./(assembly|builtin|plugins)" src/kernel        # → 无输出

# 插件不得在运行时依赖 kernel/core（绕过暂存与清单校验）
# 只允许 import type —— 编译后类型导入会消失，运行时无依赖
rg "from \"\.\./\.\./kernel/core" src/plugins --glob '!*.d.ts'
# → 只命中 src/plugins/stats/index.ts 的 `import type { EditorContext }`，属允许项

# 插件之间互不依赖：不应出现指向其它插件目录的相对导入
rg "from \"\.\./[\.\./]*(stats|dir|shape-box|tree-star|shape-diamond)/" src/plugins
# → 无输出

# 装配处是唯一认识全部插件的地方
rg -l "plugins/(stats|dir|shape-box|tree-star|shape-diamond)" src --glob '!src/plugins/**'
# → 只在 src/assembly/PluginSet.ts 出现
```

抽样结果：全部符合。唯一需要说明的是 `plugins/stats/index.ts` 里
`import type { EditorContext }` —— 那是纯类型导入（编译后消失），
插件运行时并不依赖 `kernel/core`。这一点在依赖规则里写明了允许。

Phase 1 遗留的两处"按名字分派"的现状：

| 位置 | 现状 | 是否算违反 |
|---|---|---|
| `ShapeRegistry` 的 `Map<type, provider>` | 内核只做查表，不含 `switch(type)` | 不是分派，是注册表查找 |
| `CommandRegistry` 的 `Map<name, factory>` | 同上 | 同上 |

Phase 1 的 `ShapeFactory.kernel()`（一个函数里 `register` 六次）已经消失，
现在六种图形的注册写在 `builtin/shapes/providers.ts` 的数组里，
由内置插件在 `activate` 时逐条注册。

---

# 第五部分：质量保证手段

## 1. 三层验证

| 层 | 手段 | 规模 |
|---|---|---|
| 单元 | `node --test` 共 **93** 项，覆盖加载器四类失败/回滚、`dir` 三种视角、`stats` 计数规则、`box` 不变量与 round-trip、`star` 状态机、`diamond` | `tests/*.test.cjs` |
| 端到端（CLI） | `bash tests/run.sh`：六个 Phase 1 会话 + round-trip + "禁用全部插件仍能启动"，共 **9** 项 | 期望输出逐字节存档 |
| 端到端（双装配） | `bash tests/dual-assembly.sh`：三条会话在 A/B 下逐字节相同 + 禁用新增插件后与 tag `final` 逐字节相同，共 **6** 项 | `doc/transcript/` |
| 扩展 | `pnpm test`（`vscode-extension/`）**17** 项 + 实机截图 | `vscode-extension/test/` |

`npm test` 一条命令跑完前三层（93 + 9 + 6）。

## 2. 功能完整性的判据

**Phase 1 行为不变**：不是靠"看起来一样"，而是靠**逐字节存档比对**。
`tests/expected_*.txt` 是 Phase 1 提交时的输出快照，
`tests/run.sh` 每轮用"只装内置插件"的配置重跑并 diff。任何一行偏差都会 FAIL。

**插件确实可插拔**：每个可选插件都有"未装载时报什么"的测试。
`stats`/`dir` 在只有内置插件时报 `error: unknown command: …`；
`box` 在未装插件时读入降级为普通 `g`；`modified-star` 未装时 `tree` 与 Phase 1 逐字节相同。

**契约被真的守住**：三个"违反契约"的场景各有专门测试——
handler 部分修改后抛错（回滚 + 历史不变）、manifest 不符（整批撤销）、
子部件被单独 delete/addto/group（拒绝并给出原因）。

## 3. 代码质量的依据

- **复杂度增量可见**：`docs/metrics/README.md` 由脚本从 git 历史生成。
  行数 2365 → 4394（+2029），圈复杂度 501 → 878（+377）。
  增量的分布是内核 +136、装配 +88、插件 +153：
  内核的增长集中在 `PluginHost`（196 行，契约校验与回滚）与 `SvgParser`（161 行，归属判定与降级），
  这是"把分派换成契约"的直接代价，换来的是插件侧新增一类扩展平均 20–150 行且内核零改动。
- **单文件职责单一**：最大的四个文件是 `kernel/model/Shape.ts`（263 行，图形基类）、
  `kernel/core/PluginHost.ts`（196 行，装配入口）、`kernel/io/SvgParser.ts`（161 行，
  归属判定与降级）、`plugins/shape-diamond/PolygonShape.ts`（93 行，多边形几何）。
  命令类里最长的是 `CreateCommand`（100 行，含 `in` 子句探测）与
  `TreeAction`（121 行，树渲染 + 标签拼接），其余均在 90 行以内。
- **无静默降级**：所有"能继续但要告知"的情形都打印 `warning:`，
  所有"不能继续"的情形都打印 `error:` 且不改状态。
  处理器失败会先回滚再报错，不会出现"改了一半 + 报错"的中间态。

---

# 附录：指标与产物索引

| 产物 | 位置 | 生成方式 |
|---|---|---|
| 指标（行数/复杂度/文件清单） | `docs/metrics/README.md` | `npm run metrics`（`scripts/metrics.mjs`） |
| 双装配会话素材 | `doc/transcript/*.txt`、`fixtures/` | 手写命令脚本，不含提示符与输出 |
| VSCode 截图 | `docs/images/vscode-svg-badge.jpg`、`vscode-svg-outline.jpg` | 扩展开发宿主实机截取 |
| Phase 1 输出快照 | `tests/expected_*.txt` | Phase 1 提交时留存 |
| 配置装配示例 | `plugins.config.json` | 含 `options` 与 `enabled` 用法 |
| 方式 A 演示分支 | `demo-assembly-a` | 只改 `PluginSet.ts` 一行接入 diamond |
| 加载器失败样例 | `tests/fixtures/*.js` + `config-failures.json` | 五种失败情形各一个模块 |

## 已知边界（本阶段明确不做）

1. `scale` 对 `text` 只缩放坐标、不缩放字号（Phase 1 沿用；任务书未要求）。
2. `dir` 对符号链接只报告 `isDirectory()`，不跟随目标遍历。
3. `modified-star` 每次 `tree` 全树算签名，无缓存（无实测瓶颈）。
4. VSCode 扩展不做 SVG 规范校验、不做图形预览（任务书明确不要求）。
5. `contributes` 校验只比名字集合，不比对"同名但类型不同"的实现差异。
