import { Group } from "../../kernel/model/Group";
import type { Shape } from "../../kernel/model/Shape";
import type { SvgDocument } from "../../kernel/model/SvgDocument";
import type { EditorServices } from "../../kernel/api/Plugin";
import type { TreeDecorator } from "../../kernel/api/TreeDecorator";

/**
 * 扩展点 3 的插件实现：为"自上次保存以来内容有变化"的图形追加 `*`。
 *
 * dirty 语义（ADR-3）：按**内容比对**，而不是"发生过编辑命令"。
 * 因此 `undo` 回到保存点后 `*` 自然消失，不需要命令层配合。
 *
 * 祖先传播：不传播。只有内容真的变了的那个图形自己带 `*`，
 * 容器行不替子孙背锅；唯一的例外是根行 `svg (WxH) *` ——
 * 它代表"整份文档有未保存修改"，是文档级标记，不是祖先传播。
 *
 * 状态全部保存在实例字段：baseline 是 id → 子树签名。每个会话一份实例。
 */
export class ModifiedStar implements TreeDecorator {
  readonly name = "modified-star";

  private baseline = new Map<string, string>();
  private baselineDoc: SvgDocument | null = null;

  constructor(private readonly editor: EditorServices) {
    editor.events.on("document-opened", () => this.reset());
    editor.events.on("document-saved", () => this.reset());
  }

  decorate(row: Parameters<TreeDecorator["decorate"]>[0]): string | null {
    this.syncDocument(row.doc);
    if (row.kind === "root") return this.anyDirty(row.doc) ? "*" : null;
    const shape = row.shape;
    if (!shape) return null;
    const before = this.baseline.get(shape.id);
    // 保存点之后新建的节点：之前不存在 → 有未保存变化
    if (before === undefined) return "*";
    return before === signature(shape) ? null : "*";
  }

  /** 文档被 init/read 换掉时，基线也跟着换。 */
  private syncDocument(doc: SvgDocument): void {
    if (this.baselineDoc !== doc) this.reset(doc);
  }

  private reset(doc: SvgDocument | null = this.editor.currentDocument()): void {
    this.baselineDoc = doc;
    this.baseline = new Map();
    if (!doc) return;
    for (const child of doc.root.children) this.snapshot(child);
  }

  private snapshot(shape: Shape): void {
    this.baseline.set(shape.id, signature(shape));
    if (shape instanceof Group) for (const c of shape.children) this.snapshot(c);
  }

  private anyDirty(doc: SvgDocument): boolean {
    for (const child of doc.root.children) if (this.subtreeDirty(child)) return true;
    return false;
  }

  private subtreeDirty(shape: Shape): boolean {
    const before = this.baseline.get(shape.id);
    if (before === undefined || before !== signature(shape)) return true;
    if (shape instanceof Group) {
      for (const c of shape.children) if (this.subtreeDirty(c)) return true;
    }
    return false;
  }
}

/**
 * 单个图形**自身**的确定性签名：类型 + 属性表 + 文本。
 * 不含子节点 —— 子孙的变化由 `subtreeDirty` 逐层下钻发现，
 * 这样"子图形改了"不会把祖先容器的签名也带脏。
 */
export function signature(shape: Shape): string {
  const attrs = shape
    .serializeAttrs()
    .map(([k, v]) => `${k}=${v}`)
    .join(";");
  const text = shape.textContent();
  return `${shape.tag}|${attrs}|${text === null ? "" : text}`;
}

export default ModifiedStar;
