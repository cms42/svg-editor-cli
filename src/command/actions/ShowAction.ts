import { Action, CommandError } from "../Command";
import { EditorContext } from "../EditorContext";

/** show <id>：单个图形的属性明细。 */
export class ShowAction implements Action {
  constructor(
    private readonly ctx: EditorContext,
    private readonly args: string[]
  ) {
    if (args.length !== 1) throw new CommandError("usage: show <id>");
  }

  run(): string[] {
    const doc = this.ctx.requireDoc();
    const shape = doc.find(this.args[0]);
    const lines = [`${shape.label}  parent=${doc.parentLabel(shape)}`];
    lines.push(`  ${shape.geometryLine()}`);
    const style = shape.styleLine();
    if (style) lines.push(`  ${style}`);
    return lines;
  }
}
