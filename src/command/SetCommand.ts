import { ModelError, Shape } from "../model/Shape";
import { Command, CommandError } from "./Command";
import { EditorContext } from "./EditorContext";

/** set <id> <attr> <value>：白名单校验在 Shape.set 内完成。 */
export class SetCommand implements Command {
  private readonly shape: Shape;
  private readonly attr: string;
  private readonly value: string;
  private oldValue: string | null = null;

  constructor(ctx: EditorContext, args: string[]) {
    if (args.length !== 3) throw new CommandError("usage: set <id> <attr> <value>");
    this.shape = ctx.requireDoc().find(args[0]);
    this.attr = args[1];
    this.value = args[2];
  }

  execute(): string[] {
    this.oldValue = this.shape.get(this.attr);
    try {
      const desc = this.shape.set(this.attr, this.value);
      return [`${this.shape.label} updated: ${desc}`];
    } catch (e) {
      if (e instanceof ModelError) throw new CommandError(e.message);
      throw e;
    }
  }

  undo(): string[] {
    if (this.oldValue === null) {
      // 旧值未设置：还原为"未设置"而非写回空串
      return [`${this.shape.label} updated: ${this.shape.unset(this.attr)}`];
    }
    this.shape.set(this.attr, this.oldValue);
    const desc = this.shape.describeValue(this.attr, this.oldValue);
    return [`${this.shape.label} updated: ${desc}`];
  }
}
