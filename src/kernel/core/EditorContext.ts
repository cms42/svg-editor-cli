import { CommandError } from "../api/Command";
import type { EditorEvents } from "../api/Plugin";
import { AttributeRegistry } from "./AttributeRegistry";
import { CommandRegistry } from "./CommandRegistry";
import { DecoratorRegistry } from "./DecoratorRegistry";
import { History } from "./History";
import type { ShapeRegistry } from "./ShapeRegistry";
import type { SvgDocument } from "../model/SvgDocument";

/**
 * 一次会话的共享状态：当前文档、各注册表、undo 栈、事件总线。
 * 内核命令只通过这里拿能力，插件通过 PluginContext 拿能力。
 */
export class EditorContext {
  doc: SvgDocument | null = null;
  readonly history = new History();

  constructor(
    readonly shapes: ShapeRegistry,
    readonly commands: CommandRegistry,
    readonly decorators: DecoratorRegistry,
    readonly attributes: AttributeRegistry,
    readonly events: EditorEvents,
    readonly cwd: string = process.cwd()
  ) {}

  requireDoc(): SvgDocument {
    if (!this.doc) throw new CommandError("no document. use 'init' or 'read' first");
    return this.doc;
  }
}
