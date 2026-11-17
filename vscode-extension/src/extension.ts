import * as vscode from "vscode";
import { SvgBadgeProvider, SvgDocumentSymbolProvider } from "./providers";

/**
 * 扩展入口（activate）。
 *
 * 扩展只做"注册"：把两个 provider 交给 VSCode，之后所有回调都由 VSCode 驱动。
 * 因此 VSCode 与扩展的职责边界是清楚的：
 *   - VSCode：决定何时解析（打开/编辑/切换）、把 Symbol 渲染成大纲树、
 *     处理点击跳转、绘制文件装饰；
 *   - 扩展：只提供"SVG 文本 → 元素层级"与"suffix → 装饰"这两份映射。
 */
export function activate(context: vscode.ExtensionContext): void {
  const badge = new SvgBadgeProvider();
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(badge),
    vscode.languages.registerDocumentSymbolProvider(
      { language: "svg", scheme: "file" },
      new SvgDocumentSymbolProvider(),
      { label: "SVG elements" }
    )
  );
}

export function deactivate(): void {
  // 注册项都在 context.subscriptions 里，VSCode 负责释放
}
