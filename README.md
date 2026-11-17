# PJ1：CLI 版 SVG 编辑器 + VSCode 扩展（软件设计）

- Phase 1 任务书：`phase_cli_1.md`（tag `final`，2026-10-25）
- Phase 2 任务书：`pj1-phase2/phase_cli_2.md`（tag `p2`，2026-11-27）
- 架构文档：`doc/README.md`（含扩展点清单、ADR、两种装配方式、VSCode 实践与分析）
- 指标：`docs/metrics/README.md`（`npm run metrics` 重新生成）

## 运行

```bash
npm install
npm run cli                                    # 方式 A：代码装配
npm run cli -- --config plugins.config.json    # 方式 B：配置装配
npm run cli -- --no-plugins                    # 空壳（验证内核不含实现）

npm run test        # 单测 + Phase 1 逐字节回归 + 双装配一致性
npm run metrics      # 重新生成 docs/metrics
```

VSCode 扩展在 `vscode-extension/`（独立工程）：

```bash
cd vscode-extension && pnpm install && pnpm test
# 调试：用 .vscode/launch.json 的 "Run SVG Outline Extension"
```

## Phase 1（tag `final`）

CLI 版 SVG 编辑器：文档的创建/读取/保存，六种基础图形的创建、移动、缩放、
分组、删除、属性修改、结构查看、撤销重做。TypeScript + 面向对象，
零运行时第三方依赖（XML 解析器为自实现子集）。

## Phase 2（tag `p2`）

两部分：

1. **VSCode 扩展**：Explorer 中给 `.svg` 文件加 `[]` 标记；原生大纲展示元素层级并支持点击定位。
2. **CLI 插件式重构**：把 Phase 1 改造成四个扩展点的框架——
   `ShapeProvider`（图形类型）、`Command`（命令）、`TreeDecorator`（树行尾标签）、
   `AttributeHandler`（属性领域语义）。新增的验证插件：`stats`、`dir`（适配器访问文件系统）、
   `box`（复合图形，同时占三类扩展）、`modified-star`（未保存修改标记），
   外加拓展任务的 `diamond`。同一插件支持代码装配与配置装配两种方式，
   两条路径共用同一套注册与校验逻辑。
