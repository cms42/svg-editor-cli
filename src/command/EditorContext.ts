import { ShapeFactory } from "../model/ShapeFactory";
import { SvgDocument } from "../model/SvgDocument";
import { CommandError } from "./Command";
import { History } from "./History";

/** 一次会话的共享状态：当前文档、图形工厂、undo 栈、读入路径。 */
export class EditorContext {
  doc: SvgDocument | null = null;
  readonly factory = ShapeFactory.kernel();
  readonly history = new History();

  requireDoc(): SvgDocument {
    if (!this.doc)
      throw new CommandError("no document. use 'init' or 'read' first");
    return this.doc;
  }
}
