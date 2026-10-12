import { Group } from "../model/Group";
import { Shape } from "../model/Shape";
import { ShapeSpec } from "../model/ShapeFactory";
import { Command, CommandError } from "./Command";
import { EditorContext } from "./EditorContext";

/** create <type> <id> [params…] [in <containerId>] */
export class CreateCommand implements Command {
  private readonly ctx: EditorContext;
  private readonly type: string;
  private readonly id: string;
  private readonly spec: ShapeSpec;
  private readonly container: Group | null;
  private shape: Shape | null = null;

  constructor(ctx: EditorContext, args: string[]) {
    this.ctx = ctx;
    if (args.length < 2)
      throw new CommandError("usage: create <type> <id> [params…] [in <containerId>]");
    const [type, id, ...rest] = args;
    const doc = ctx.requireDoc();

    let containerId: string | null = null;
    const inIdx = rest.lastIndexOf("in");
    let params = rest;
    if (inIdx >= 0) {
      if (inIdx !== rest.length - 2)
        throw new CommandError("usage: create <type> <id> [params…] [in <containerId>]");
      containerId = rest[inIdx + 1];
      params = rest.slice(0, inIdx);
    }

    if (doc.has(id)) throw new CommandError(`id already exists: ${id}`);
    if (containerId !== null) {
      const target = doc.find(containerId);
      if (!target.isContainer())
        throw new CommandError(`not a container: ${containerId}`);
      this.container = target as Group;
    } else {
      this.container = null;
    }

    // 未知类型 / 参数错误在构造阶段抛出，不产生任何状态变化
    try {
      this.spec = ctx.factory.parse(type, params);
    } catch (e) {
      if (e instanceof Error && e.message === "wrong number of arguments") {
        const usage = ctx.factory.usage(type);
        if (usage) throw new CommandError(`usage: ${usage}`);
      }
      throw e;
    }
    this.type = type;
    this.id = id;
  }

  execute(): string[] {
    const doc = this.ctx.requireDoc();
    const parent = this.container ?? doc.root;
    const shape = this.ctx.factory.create(this.type, this.id, this.spec);
    doc.attach(shape, parent);
    this.shape = shape;
    if (this.container)
      return [`${shape.label} created in ${this.container.label}`];
    return [`${shape.label} created`];
  }

  undo(): string[] {
    const doc = this.ctx.requireDoc();
    if (this.shape) doc.detach(this.shape);
    return [`${this.type}#${this.id} deleted`];
  }
}
