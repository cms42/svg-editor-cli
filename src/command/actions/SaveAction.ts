import * as fs from "fs";
import { SvgSerializer } from "../../io/SvgSerializer";
import { Action, CommandError } from "../Command";
import { EditorContext } from "../EditorContext";

/** save [file.svg]：保存当前文档；无参数时保存到读入时的路径。 */
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
    return [`saved to ${file} (${doc.count()} elements)`];
  }
}
