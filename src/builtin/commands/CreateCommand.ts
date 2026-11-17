import type { Group } from "../../kernel/model/Group";
import type { Shape } from "../../kernel/model/Shape";
import type { ShapeSpec } from "../../kernel/api/ShapeProvider";
import { Command, CommandError } from "../../kernel/api/Command";
import type { EditorContext } from "../../kernel/core/EditorContext";

/**
 * create <type> <id> [params…] [in <containerId>]
 *
 * 类型解析与实例化全部委托给 ShapeRegistry（扩展点 1），内核不认识任何具体类型。
 * Shape 实例只在首次 execute 时创建一次；undo=detach、redo=重新 attach 同一实例，
 * 保证 redo 链上的后续命令持有的对象身份不分裂。
 */
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

    // in 子句按类型 schema 定位：去掉尾部 `in <id>` 后参数个数须恰好匹配，
    // 否则 "in" 只是普通参数（如 text 内容 / fill 值）。
    let params = rest;
    let containerId: string | null = null;
    let spec: ShapeSpec | null = null;
    if (rest.length >= 2 && rest[rest.length - 2] === "in") {
      const candidate = rest.slice(0, -2);
      try {
        spec = ctx.shapes.parse(type, candidate);
        params = candidate;
        containerId = rest[rest.length - 1];
      } catch (e) {
        if (!(e instanceof Error && e.message === "wrong number of arguments"))
          throw e; // 无效数字等真实错误，不回退
      }
    }
    if (spec === null) {
      try {
        spec = ctx.shapes.parse(type, params);
      } catch (e) {
        if (e instanceof Error && e.message === "wrong number of arguments") {
          const usage = ctx.shapes.usage(type);
          if (usage) throw new CommandError(`usage: ${usage}`);
        }
        throw e;
      }
    }
    this.spec = spec;

    if (doc.has(id)) throw new CommandError(`id already exists: ${id}`);
    if (containerId !== null) {
      if (!doc.has(containerId))
        throw new CommandError(`no such container: ${containerId}`);
      const target = doc.find(containerId);
      if (!target.isContainer())
        throw new CommandError(`not a container: ${containerId}`);
      this.container = target as Group;
    } else {
      this.container = null;
    }
    this.type = type;
    this.id = id;
  }

  execute(): string[] {
    const doc = this.ctx.requireDoc();
    // 构造期校验后 doc 可能已变（redo 场景 id 被新编辑占用），执行期再查一次
    if (doc.has(this.id)) throw new CommandError(`id already exists: ${this.id}`);
    if (!this.shape) {
      try {
        this.shape = this.ctx.shapes.create(this.type, this.id, this.spec, {
          isIdTaken: (candidate) => doc.has(candidate),
        });
      } catch (e) {
        if (e instanceof Error && e.name === "ModelError")
          throw new CommandError(e.message);
        throw e;
      }
    }
    const parent = this.container ?? doc.root;
    doc.attach(this.shape, parent);
    if (this.container)
      return [`${this.shape.typedLabel} created in ${this.container.label}`];
    return [`${this.shape.typedLabel} created`];
  }

  undo(): string[] {
    const doc = this.ctx.requireDoc();
    if (this.shape) doc.detach(this.shape);
    return [`${this.type}#${this.id} deleted`];
  }
}
