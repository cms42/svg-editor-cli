import * as vscode from "vscode";
import { buildOutline } from "./outline";
import type { OutlineNode } from "./outline";

/**
 * SVG 文档符号提供者 —— 把 SVG 元素层级喂给 VSCode 原生 Outline（大纲）。
 *
 * 这是 VSCode 侧「被调用」的角色：扩展向 VSCode 注册一个 provider，
 * 之后由 VSCode 在打开文件、编辑、切换标签时回调 `provideDocumentSymbols`；
 * 扩展不能主动往大纲里塞内容，只能应答。
 */
export class SvgDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(
    document: vscode.TextDocument
  ): vscode.DocumentSymbol[] | undefined {
    const result = buildOutline(document.getText());
    // XML 不完整：暂时返回空大纲（不抛错、不崩溃）
    if (result.incomplete) return [];
    return result.nodes.map((n) => this.toSymbol(n, document));
  }

  private toSymbol(node: OutlineNode, document: vscode.TextDocument): vscode.DocumentSymbol {
    const range = this.rangeOfTag(node.offset, document);
    const symbol = new vscode.DocumentSymbol(
      node.label,
      "",
      vscode.SymbolKind.Object,
      range,
      range
    );
    symbol.children = node.children.map((c) => this.toSymbol(c, document));
    return symbol;
  }

  /** 只覆盖起始标签，点击大纲即跳到该行该列。 */
  private rangeOfTag(offset: number, document: vscode.TextDocument): vscode.Range {
    const start = document.positionAt(offset);
    const line = document.lineAt(start.line);
    return new vscode.Range(start, line.range.end);
  }
}

/**
 * Explorer 装饰提供者 —— 给 `.svg` 文件加 `[]` 标记。
 *
 * 标记是**界面附加信息**：只改装饰，不改文件名，也不改文件内容。
 */
export class SvgBadgeProvider implements vscode.FileDecorationProvider {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri[]>();
  readonly onDidChangeFileDecorations = this.onDidChangeEmitter.event;

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (!uri.path.toLowerCase().endsWith(".svg")) return undefined;
    return {
      badge: "[]",
      tooltip: "SVG document",
      // 不设 color/propagate：目录与非 SVG 文件因此不会有任何标记
    };
  }

  /** 供测试与手动刷新使用。 */
  refresh(): void {
    this.onDidChangeEmitter.fire([]);
  }
}
