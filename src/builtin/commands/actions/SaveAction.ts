import * as fs from "fs";
import { SvgSerializer } from "../../../kernel/io/SvgSerializer";
import { Action, CommandError } from "../../../kernel/api/Command";
import type { EditorContext } from "../../../kernel/core/EditorContext";

/**
 * save [file.svg]：保存当前文档；无参数时保存到读入时的路径。
 * 序列化后广播 document-saved，标签插件据此重置自己的基线。
 */
export class SaveAction implements Action {
  constructor(
    private readonly ctx: EditorContext,
    private readonly args: string[]
  ) {
    if (args.length > 1) throw new CommandError("usage: save [file.svg]");
  }

  run(): string[] {
    const doc = this.ctx.requireDoc();
    const file = this.args[0] ?? doc.sourcePath;
    if (!file)
      throw new CommandError("no file name. use 'save <file.svg>'");
    const xml = new SvgSerializer().serialize(doc);
    try {
      fs.writeFileSync(file, xml, "utf-8");
    } catch {
      throw new CommandError(`cannot write file: ${file}`);
    }
    doc.sourcePath = file;
    this.ctx.history.block();
    this.ctx.events.emit("document-saved");
    return [`saved to ${file} (${doc.count()} elements)`];
  }
}
