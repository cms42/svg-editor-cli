import * as fs from "fs";
import { SvgParser, SvgReadError } from "../../io/SvgParser";
import { Action, CommandError } from "../Command";
import { EditorContext } from "../EditorContext";

/** read <file.svg>：读入 SVG 文件为当前文档；缺 id 自动补并警告。 */
export class ReadAction implements Action {
  constructor(
    private readonly ctx: EditorContext,
    private readonly args: string[]
  ) {
    if (args.length !== 1) throw new CommandError("usage: read <file.svg>");
  }

  run(): string[] {
    const file = this.args[0];
    let source: string;
    try {
      source = fs.readFileSync(file, "utf-8");
    } catch {
      throw new CommandError(`cannot read file: ${file}`);
    }
    let result;
    try {
      result = new SvgParser(this.ctx.factory).parse(source);
    } catch (e) {
      if (e instanceof SvgReadError)
        throw new CommandError(`cannot parse ${file}: ${e.message}`);
      throw e;
    }
    this.ctx.doc = result.doc;
    this.ctx.doc.sourcePath = file;
    this.ctx.history.block();
    return [...result.warnings, `read ${file} (${result.doc.count()} elements)`];
  }
}
