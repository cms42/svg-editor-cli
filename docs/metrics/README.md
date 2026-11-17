# CLI 指标（由 scripts/metrics.mjs 从 git 历史生成）

- 基线：`final`（Phase 1 提交）
- 当前：`工作区（p2 收尾）`
- 范围：CLI（`src/`），排除依赖包与构建产物；VSCode 扩展单独一节
- 数字全部由脚本现场计算，不接受手填

## 1. 行数按职责拆分

| 类别 | 包含目录 | final 行数 | WORKTREE 行数 | 增量 |
|---|---|---:|---:|---:|
| kernel | `src/kernel/`（Phase 1: `src/model/` `src/io/` `src/command/Command.ts` `History.ts`） | 1354 | 2091 | +737 |
| assembly | `src/assembly/` `src/cli/` | 108 | 470 | +362 |
| plugin | `src/builtin/` `src/plugins/`（Phase 1: `src/command/` 各命令） | 903 | 1833 | +930 |
| **合计** | | **2365** | **4394** | **+2029** |

## 2. 圈复杂度（函数级判定点累计，脚本近似 McCabe）

| 类别 | final | WORKTREE | 增量 |
|---|---:|---:|---:|
| kernel | 284 | 420 | +136 |
| assembly | 31 | 119 | +88 |
| plugin | 186 | 339 | +153 |
| **合计** | **501** | **878** | **+377** |

> 复杂度上升主要来自扩展点的契约校验与失败回滚（加载器、清单比对、事务日志），
> 这是「用可控的框架复杂度换插件侧的零改动」的直接代价。

## 3. 文件清单与职责

| 类别 | 文件 | 行数 | 职责 |
|---|---|---:|---|
| kernel | `src/kernel/api/AttributeHandler.ts` | 41 | 扩展点 4：属性领域语义 + 事务接口 |
| kernel | `src/kernel/api/Command.ts` | 38 | Command/Action 接口 + 错误类型 + help 条目结构 |
| kernel | `src/kernel/api/Plugin.ts` | 94 | 插件上下文、事件总线、清单类型 |
| kernel | `src/kernel/api/ShapeProvider.ts` | 65 | 扩展点 1：图形类型的创建与读回契约 |
| kernel | `src/kernel/api/TreeDecorator.ts` | 24 | 扩展点 3：树行尾标签契约 |
| kernel | `src/kernel/core/AttributeRegistry.ts` | 64 | 扩展点 4 注册表 + set 事务日志 |
| kernel | `src/kernel/core/CommandRegistry.ts` | 76 | 扩展点 2 注册表 + 命令分发 + help 拼装 |
| kernel | `src/kernel/core/DecoratorRegistry.ts` | 27 | 扩展点 3 注册表（每会话一实例） |
| kernel | `src/kernel/core/EditorContext.ts` | 31 | 会话状态容器（文档、注册表、历史、事件） |
| kernel | `src/kernel/core/History.ts` | 50 | undo/redo 栈与 io 后禁用规则 |
| kernel | `src/kernel/core/PluginHost.ts` | 196 | 唯一装配入口：暂存注册、清单校验、去重、回滚 |
| kernel | `src/kernel/core/ShapeRegistry.ts` | 58 | 扩展点 1 注册表（类型名与读回标签双索引） |
| kernel | `src/kernel/io/SvgParser.ts` | 161 | SVG 读入：按注册表决定元素归属与降级 |
| kernel | `src/kernel/io/SvgSerializer.ts` | 51 | SVG 写出（含扩展属性） |
| kernel | `src/kernel/io/XmlParser.ts` | 142 | 迷你 XML 解析器 |
| kernel | `src/kernel/model/Circle.ts` | 93 | 圆 |
| kernel | `src/kernel/model/Ellipse.ts` | 105 | 椭圆 |
| kernel | `src/kernel/model/Format.ts` | 13 | 数字格式化与字面量校验 |
| kernel | `src/kernel/model/Group.ts` | 85 | 容器（Composite）+ 深度优先遍历 |
| kernel | `src/kernel/model/Line.ts` | 108 | 线段 |
| kernel | `src/kernel/model/Rect.ts` | 105 | 矩形 |
| kernel | `src/kernel/model/Shape.ts` | 263 | 图形基类（Composite 的 Component）+ 属性封装 + 扩展属性槽 |
| kernel | `src/kernel/model/SvgDocument.ts` | 99 | 画布 + 根容器 + id 索引（唯一性在此强制） |
| kernel | `src/kernel/model/TextShape.ts` | 102 | 文本（内容为子文本） |
| assembly | `src/assembly/ConfigAssembly.ts` | 57 | 装配方式 B：读配置装载 |
| assembly | `src/assembly/Editor.ts` | 50 | 组合根：构造空壳编辑器 |
| assembly | `src/assembly/PluginLoader.ts` | 180 | 按模块名解析/求值 + 四类失败判定 |
| assembly | `src/assembly/PluginSet.ts` | 26 | 装配方式 A：代码装配 |
| assembly | `src/cli/Repl.ts` | 52 | REPL：分词后交给注册表分发，不认识任何具体命令 |
| assembly | `src/cli/main.ts` | 73 | 入口：解析 --config/--no-plugins，选择装配方式 |
| assembly | `src/cli/tokenize.ts` | 32 | 命令行分词（双引号包裹） |
| plugin | `src/builtin/commands/AddToCommand.ts` | 54 |  |
| plugin | `src/builtin/commands/CreateCommand.ts` | 100 |  |
| plugin | `src/builtin/commands/DeleteCommand.ts` | 39 |  |
| plugin | `src/builtin/commands/GroupCommand.ts` | 91 |  |
| plugin | `src/builtin/commands/MoveCommand.ts` | 44 |  |
| plugin | `src/builtin/commands/ScaleCommand.ts` | 29 |  |
| plugin | `src/builtin/commands/SetCommand.ts` | 82 |  |
| plugin | `src/builtin/commands/UngroupCommand.ts` | 54 |  |
| plugin | `src/builtin/commands/ZOrderCommand.ts` | 38 |  |
| plugin | `src/builtin/commands/actions/CanvasAction.ts` | 27 |  |
| plugin | `src/builtin/commands/actions/HelpAction.ts` | 15 |  |
| plugin | `src/builtin/commands/actions/InitAction.ts` | 29 |  |
| plugin | `src/builtin/commands/actions/ReadAction.ts` | 37 |  |
| plugin | `src/builtin/commands/actions/SaveAction.ts` | 34 |  |
| plugin | `src/builtin/commands/actions/ShowAction.ts` | 22 |  |
| plugin | `src/builtin/commands/actions/TreeAction.ts` | 121 |  |
| plugin | `src/builtin/commands/actions/UndoRedoAction.ts` | 17 |  |
| plugin | `src/builtin/index.ts` | 140 |  |
| plugin | `src/builtin/shapes/params.ts` | 32 |  |
| plugin | `src/builtin/shapes/providers.ts` | 77 |  |
| plugin | `src/plugins/dir/DirectoryReader.ts` | 24 |  |
| plugin | `src/plugins/dir/FsDirectoryReader.ts` | 26 |  |
| plugin | `src/plugins/dir/format.ts` | 26 |  |
| plugin | `src/plugins/dir/index.ts` | 61 | 命令插件：目录查看（经适配器） |
| plugin | `src/plugins/shape-box/BoxAttributeHandler.ts` | 57 | 属性插件：box 的 fill/label 语义 |
| plugin | `src/plugins/shape-box/BoxShape.ts` | 59 | box 容器类：子部件锁定与类型标注 |
| plugin | `src/plugins/shape-box/BoxTypeLabel.ts` | 19 | 树标签插件：(box) 标注 |
| plugin | `src/plugins/shape-box/boxProvider.ts` | 120 | 图形插件：box 的创建与读回 |
| plugin | `src/plugins/shape-box/index.ts` | 28 | box 插件装配（图形 + 属性 + 标签三类注册） |
| plugin | `src/plugins/shape-diamond/PolygonShape.ts` | 93 |  |
| plugin | `src/plugins/shape-diamond/index.ts` | 73 |  |
| plugin | `src/plugins/stats/index.ts` | 60 | 命令插件：图形统计 |
| plugin | `src/plugins/tree-star/ModifiedStar.ts` | 87 | 树标签插件：未保存修改的 * |
| plugin | `src/plugins/tree-star/index.ts` | 18 | star 插件装配 |

## 4. VSCode 扩展（不计入 CLI 增量）

| 文件 | 行数 | 职责 |
|---|---:|---|
| `vscode-extension/src/extension.ts` | 27 | activate：注册两个 provider |
| `vscode-extension/src/outline.ts` | 147 | SVG 文本 → 大纲节点的纯函数（可单测） |
| `vscode-extension/src/providers.ts` | 65 | VSCode provider：文件装饰 + 文档符号 |

小计：239 行，圈复杂度 45。

