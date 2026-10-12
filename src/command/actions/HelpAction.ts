import { Action } from "../Command";
import { EditorContext } from "../EditorContext";

/** help：显示全部命令与语法。 */
export class HelpAction implements Action {
  constructor(private readonly ctx: EditorContext) {
    void this.ctx;
  }

  run(): string[] {
    return [
      "document:",
      "  init [w] [h]                              new blank canvas (default 800x600)",
      "  read <file.svg>                           load SVG file as current document",
      "  save [file.svg]                           save document (default: path from read)",
      "  canvas [w] [h]                            show or resize the canvas",
      "edit (undoable):",
      "  create <type> <id> [params…] [in <gid>]   types: rect circle ellipse line text g",
      "  delete <id>                               delete shape (containers take subtree)",
      "  move <id> <dx> <dy>                       translate (containers move as a whole)",
      "  scale <id> <factor>                       uniform scale of all geometry",
      "  set <id> <attr> <value>                   attrs: fill stroke stroke-width, geometry, text",
      "  group <newGid> <id1> <id2>…               collect existing shapes into a new g",
      "  ungroup <gid>                             dissolve a container",
      "  addto <gid> <id>                          move an existing shape into a container",
      "  front <id> / back <id>                    z-order among siblings",
      "display:",
      "  tree [id]                                 structure tree with inline geometry",
      "  show <id>                                 attribute details of one shape",
      "  help                                      this help",
      "history:",
      "  undo / redo                               undo/redo last edit command",
      "  exit                                      quit",
    ];
  }
}
