import { Group } from "../model/Group";
import { Shape } from "../model/Shape";
import { Command, CommandError } from "./Command";
import { EditorContext } from "./EditorContext";

interface Slot {
  shape: Shape;
  parent: Group;
  index: number;
}

/** group <newGid> <id1> <id2>…：新建容器收编已存在图形，整体一个 undo 单元。 */
export class GroupCommand implements Command {
  private readonly ctx: EditorContext;
  private readonly gid: string;
  private readonly targets: Shape[];
  private group: Group | null = null;
  private slots: Slot[] = [];
  private groupParent: Group | null = null;
  private groupIndex = 0;

  constructor(ctx: EditorContext, args: string[]) {
    this.ctx = ctx;
    if (args.length < 2)
      throw new CommandError("usage: group <newGid> <id1> <id2>…");
    const doc = ctx.requireDoc();
    const [gid, ...ids] = args;
    if (doc.has(gid)) throw new CommandError(`id already exists: ${gid}`);
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) throw new CommandError(`duplicate id: ${id}`);
      seen.add(id);
    }
    this.targets = ids.map((id) => doc.find(id));
    // 目标同时含某容器与其子孙 → 拒绝，报容器名
    for (const c of this.targets) {
      if (!c.isContainer()) continue;
      for (const other of this.targets) {
        if (other === c) continue;
        if (isDescendant(c, other))
          throw new CommandError(
            `cannot group a container into its own descendant: ${c.id}`
          );
      }
    }
    this.gid = gid;
  }

  execute(): string[] {
    const doc = this.ctx.requireDoc();
    const g = new Group(this.gid);
    // 挂到第一个目标的父容器、占据其位置
    const first = this.targets[0];
    const anchorParent = first.parent ?? doc.root;
    const anchorIndex = anchorParent.childIndex(first);
    doc.attach(g, anchorParent, anchorIndex);
    this.groupParent = anchorParent;
    this.groupIndex = anchorIndex;
    this.slots = [];
    for (const t of this.targets) {
      const { parent, index } = doc.detach(t);
      this.slots.push({ shape: t, parent, index });
      doc.attach(t, g);
    }
    this.group = g;
    return [`g#${this.gid} created with ${this.targets.length} children`];
  }

  undo(): string[] {
    const doc = this.ctx.requireDoc();
    if (this.group) {
      for (const slot of [...this.slots].reverse()) {
        doc.detach(slot.shape);
        doc.attach(slot.shape, slot.parent, slot.index);
      }
      doc.detach(this.group);
    }
    return [`g#${this.gid} dissolved, children restored`];
  }
}

/** other 是否是 container 的子孙。 */
function isDescendant(container: Shape, other: Shape): boolean {
  let p = other.parent;
  while (p) {
    if (p === container) return true;
    p = p.parent;
  }
  return false;
}
