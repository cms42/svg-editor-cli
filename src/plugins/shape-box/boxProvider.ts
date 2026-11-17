import { isNumericLiteral } from "../../kernel/model/Format";
import { ModelError } from "../../kernel/model/Shape";
import { Rect } from "../../kernel/model/Rect";
import { TextShape } from "../../kernel/model/TextShape";
import { ShapeReadError } from "../../kernel/api/ShapeProvider";
import type {
  ShapeCreateContext,
  ShapeNode,
  ShapeProvider,
  ShapeSpec,
} from "../../kernel/api/ShapeProvider";
import { BoxShape, LABEL_DX, LABEL_DY, labelIdOf, rectIdOf } from "./BoxShape";

function specNumber(spec: ShapeSpec, key: string): number {
  const raw = spec.attrs.get(key);
  if (raw === undefined || !isNumericLiteral(raw))
    throw new ModelError(`invalid number for ${key}: ${raw ?? ""}`);
  return Number(raw);
}

function nodeNumber(node: ShapeNode, key: string, boxId: string): number {
  const raw = node.attrs.get(key);
  const v = raw === undefined ? NaN : Number(raw);
  if (!Number.isFinite(v))
    throw new ShapeReadError(`box ${boxId}: <${node.tag}> missing numeric ${key}`);
  return v;
}

/**
 * box 的图形 provider（扩展点 1 的插件实现）。
 *
 * create 参数：`create box <id> <x> <y> <w> <h> "<标题>" [in <gid>]`
 * CreateCommand 已剥掉 type/id，因此 parse 收到 5 个参数。
 * 参数个数不符时抛固定文案 `wrong number of arguments`，让 `in` 子句探测正常回退。
 *
 * 读回：`<g data-kind="box">` 必须恰好含一个 rect + 一个 text，
 * 否则整份读入失败 —— 绝不生成残缺 box。
 */
export const boxProvider: ShapeProvider = {
  type: "box",
  usage: 'create box <id> <x> <y> <width> <height> "<label>" [in <containerId>]',
  readTags: ["g"],
  ownsChildren: true,

  parse(args) {
    if (args.length !== 5) throw new ModelError("wrong number of arguments");
    return {
      attrs: new Map([
        ["x", args[0]],
        ["y", args[1]],
        ["width", args[2]],
        ["height", args[3]],
      ]),
      text: args[4],
    };
  },

  create(id, spec, ctx: ShapeCreateContext) {
    const x = specNumber(spec, "x");
    const y = specNumber(spec, "y");
    const w = specNumber(spec, "width");
    const h = specNumber(spec, "height");

    // 子部件 id 冲突：整条命令失败，不留容器也不留子部件
    for (const candidate of [rectIdOf(id), labelIdOf(id)]) {
      if (ctx.isIdTaken(candidate))
        throw new ModelError(`id already exists: ${candidate}`);
    }

    const rect = new Rect(rectIdOf(id), x, y, w, h);
    const text = new TextShape(labelIdOf(id), x + LABEL_DX, y + LABEL_DY, spec.text ?? "");
    const box = new BoxShape(id, rect, text);
    box.addExtraAttr("data-kind", "box");
    return box;
  },

  fromNode(node, id, ctx) {
    if (node.tag !== "g") throw new ShapeReadError(`box expects <g>, got <${node.tag}>`);
    if (node.children.length !== 2)
      throw new ShapeReadError(
        `box ${id} must have exactly 2 children, got ${node.children.length}`
      );
    const [rectNode, textNode] = node.children;
    if (rectNode.tag !== "rect" || textNode.tag !== "text")
      throw new ShapeReadError(
        `box ${id} must contain <rect>+<text>, got <${rectNode.tag}>+<${textNode.tag}>`
      );

    const rectId = rectNode.attrs.get("id") ?? rectIdOf(id);
    const labelId = textNode.attrs.get("id") ?? labelIdOf(id);
    if (ctx.isIdTaken(rectId)) throw new ShapeReadError(`duplicate id: ${rectId}`);
    if (ctx.isIdTaken(labelId)) throw new ShapeReadError(`duplicate id: ${labelId}`);

    const rect = new Rect(
      rectId,
      nodeNumber(rectNode, "x", id),
      nodeNumber(rectNode, "y", id),
      nodeNumber(rectNode, "width", id),
      nodeNumber(rectNode, "height", id)
    );
    rect.initStyle(
      rectNode.attrs.get("fill") ?? null,
      rectNode.attrs.get("stroke") ?? null,
      rectNode.attrs.get("stroke-width") ?? null
    );

    const text = new TextShape(
      labelId,
      nodeNumber(textNode, "x", id),
      nodeNumber(textNode, "y", id),
      textNode.text
    );

    const box = new BoxShape(id, rect, text);
    box.addExtraAttr("data-kind", "box");
    return box;
  },
};

export default boxProvider;
