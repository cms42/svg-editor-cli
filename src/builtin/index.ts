import type { PluginModule, PluginContext } from "../kernel/api/Plugin";
import { builtinShapeProviders } from "./shapes/providers";
import { CreateCommand } from "./commands/CreateCommand";
import { DeleteCommand } from "./commands/DeleteCommand";
import { MoveCommand } from "./commands/MoveCommand";
import { ScaleCommand } from "./commands/ScaleCommand";
import { SetCommand } from "./commands/SetCommand";
import { GroupCommand } from "./commands/GroupCommand";
import { UngroupCommand } from "./commands/UngroupCommand";
import { AddToCommand } from "./commands/AddToCommand";
import { ZOrderCommand } from "./commands/ZOrderCommand";
import { InitAction } from "./commands/actions/InitAction";
import { ReadAction } from "./commands/actions/ReadAction";
import { SaveAction } from "./commands/actions/SaveAction";
import { CanvasAction } from "./commands/actions/CanvasAction";
import { TreeAction } from "./commands/actions/TreeAction";
import { ShowAction } from "./commands/actions/ShowAction";
import { HelpAction } from "./commands/actions/HelpAction";
import { RedoAction, UndoAction } from "./commands/actions/UndoRedoAction";

const SHAPES = builtinShapeProviders.map((p) => p.type);

const COMMANDS = [
  "init",
  "read",
  "save",
  "canvas",
  "create",
  "delete",
  "move",
  "scale",
  "set",
  "group",
  "ungroup",
  "addto",
  "front",
  "back",
  "tree",
  "show",
  "help",
  "undo",
  "redo",
];

/**
 * 内置插件：Phase 1 的六种图形与全部命令，本身就是一个普通插件，
 * 通过同一套扩展点注册进内核。禁用所有插件时编辑器只是一个空壳
 * （连 init 都没有），这正是「内核不含实现」的直接体现。
 */
export const builtinPlugin: PluginModule = {
  name: "@svgframe/builtin",
  contributes: { shapes: SHAPES, commands: COMMANDS },
  activate(ctx: PluginContext): void {
    for (const p of builtinShapeProviders) ctx.registerShape(p);

    // 文档类
    ctx.registerCommand("init", (c, a) => new InitAction(c, a), {
      section: "document",
      line: "  init [w] [h]                              new blank canvas (default 800x600)",
    });
    ctx.registerCommand("read", (c, a) => new ReadAction(c, a), {
      section: "document",
      line: "  read <file.svg>                           load SVG file as current document",
    });
    ctx.registerCommand("save", (c, a) => new SaveAction(c, a), {
      section: "document",
      line: "  save [file.svg]                           save document (default: path from read)",
    });
    ctx.registerCommand("canvas", (c, a) => new CanvasAction(c, a), {
      section: "document",
      line: "  canvas [w] [h]                            show or resize the canvas",
    });

    // 编辑类
    ctx.registerCommand("create", (c, a) => new CreateCommand(c, a), {
      section: "edit (undoable)",
      line: () =>
        `  create <type> <id> [params…] [in <gid>]   types: ${ctx.editor
          .shapeTypes()
          .join(" ")}`,
    });
    ctx.registerCommand("delete", (c, a) => new DeleteCommand(c, a), {
      section: "edit (undoable)",
      line: "  delete <id>                               delete shape (containers take subtree)",
    });
    ctx.registerCommand("move", (c, a) => new MoveCommand(c, a), {
      section: "edit (undoable)",
      line: "  move <id> <dx> <dy>                       translate (containers move as a whole)",
    });
    ctx.registerCommand("scale", (c, a) => new ScaleCommand(c, a), {
      section: "edit (undoable)",
      line: "  scale <id> <factor>                       uniform scale of all geometry",
    });
    ctx.registerCommand("set", (c, a) => new SetCommand(c, a), {
      section: "edit (undoable)",
      line: "  set <id> <attr> <value>                   attrs: fill stroke stroke-width, geometry, text",
    });
    ctx.registerCommand("group", (c, a) => new GroupCommand(c, a), {
      section: "edit (undoable)",
      line: "  group <newGid> <id1> <id2>…               collect existing shapes into a new g",
    });
    ctx.registerCommand("ungroup", (c, a) => new UngroupCommand(c, a), {
      section: "edit (undoable)",
      line: "  ungroup <gid>                             dissolve a container",
    });
    ctx.registerCommand("addto", (c, a) => new AddToCommand(c, a), {
      section: "edit (undoable)",
      line: "  addto <gid> <id>                          move an existing shape into a container",
    });
    ctx.registerCommand("front", (c, a) => new ZOrderCommand(c, a, true), {
      section: "edit (undoable)",
      line: "  front <id> / back <id>                    z-order among siblings",
    });
    ctx.registerCommand("back", (c, a) => new ZOrderCommand(c, a, false));

    // 显示类
    ctx.registerCommand("tree", (c, a) => new TreeAction(c, a), {
      section: "display",
      line: "  tree [id]                                 structure tree with inline geometry",
    });
    ctx.registerCommand("show", (c, a) => new ShowAction(c, a), {
      section: "display",
      line: "  show <id>                                 attribute details of one shape",
    });
    ctx.registerCommand("help", (c) => new HelpAction(c), {
      section: "display",
      line: "  help                                      this help",
    });

    // 撤销重做
    ctx.registerCommand("undo", (c) => new UndoAction(c), {
      section: "history",
      line: "  undo / redo                               undo/redo last edit command",
    });
    ctx.registerCommand("redo", (c) => new RedoAction(c));
    ctx.registerHelp("history", "  exit                                      quit");
  },
};

export default builtinPlugin;
