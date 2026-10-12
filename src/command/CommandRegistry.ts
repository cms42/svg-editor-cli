import { Action, Command, CommandError } from "./Command";
import { EditorContext } from "./EditorContext";
import { CreateCommand } from "./CreateCommand";
import { DeleteCommand } from "./DeleteCommand";
import { MoveCommand } from "./MoveCommand";
import { ScaleCommand } from "./ScaleCommand";
import { SetCommand } from "./SetCommand";
import { GroupCommand } from "./GroupCommand";
import { UngroupCommand } from "./UngroupCommand";
import { AddToCommand } from "./AddToCommand";
import { ZOrderCommand } from "./ZOrderCommand";
import { InitAction } from "./actions/InitAction";
import { ReadAction } from "./actions/ReadAction";
import { SaveAction } from "./actions/SaveAction";
import { CanvasAction } from "./actions/CanvasAction";
import { TreeAction } from "./actions/TreeAction";
import { ShowAction } from "./actions/ShowAction";
import { HelpAction } from "./actions/HelpAction";
import { RedoAction, UndoAction } from "./actions/UndoRedoAction";

export type CommandFactory = (ctx: EditorContext, args: string[]) => Command | Action;

/**
 * 命令注册表：全系统仅有的两处按名分派之一（另一处是 ShapeFactory）。
 * 新命令 register 一行即可接入。
 */
export class CommandRegistry {
  private readonly handlers = new Map<string, CommandFactory>();

  register(name: string, factory: CommandFactory): void {
    this.handlers.set(name, factory);
  }

  dispatch(ctx: EditorContext, name: string, args: string[]): string[] {
    const f = this.handlers.get(name);
    if (!f) throw new CommandError(`unknown command: ${name}`);
    const unit = f(ctx, args);
    if (isUndoable(unit)) return ctx.history.execute(unit);
    return unit.run();
  }

  static builtin(): CommandRegistry {
    const r = new CommandRegistry();
    // 文档类
    r.register("init", (ctx, a) => new InitAction(ctx, a));
    r.register("read", (ctx, a) => new ReadAction(ctx, a));
    r.register("save", (ctx, a) => new SaveAction(ctx, a));
    r.register("canvas", (ctx, a) => new CanvasAction(ctx, a));
    // 编辑类（可 undo）
    r.register("create", (ctx, a) => new CreateCommand(ctx, a));
    r.register("delete", (ctx, a) => new DeleteCommand(ctx, a));
    r.register("move", (ctx, a) => new MoveCommand(ctx, a));
    r.register("scale", (ctx, a) => new ScaleCommand(ctx, a));
    r.register("set", (ctx, a) => new SetCommand(ctx, a));
    r.register("group", (ctx, a) => new GroupCommand(ctx, a));
    r.register("ungroup", (ctx, a) => new UngroupCommand(ctx, a));
    r.register("addto", (ctx, a) => new AddToCommand(ctx, a));
    r.register("front", (ctx, a) => new ZOrderCommand(ctx, a, true));
    r.register("back", (ctx, a) => new ZOrderCommand(ctx, a, false));
    // 显示类
    r.register("tree", (ctx, a) => new TreeAction(ctx, a));
    r.register("show", (ctx, a) => new ShowAction(ctx, a));
    r.register("help", (ctx) => new HelpAction(ctx));
    // 撤销重做
    r.register("undo", (ctx) => new UndoAction(ctx));
    r.register("redo", (ctx) => new RedoAction(ctx));
    return r;
  }
}

function isUndoable(x: Command | Action): x is Command {
  return typeof (x as Command).execute === "function";
}
