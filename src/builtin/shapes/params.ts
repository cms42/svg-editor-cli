import { isNumericLiteral } from "../../kernel/model/Format";
import { ModelError } from "../../kernel/model/Shape";
import type { ShapeSpec } from "../../kernel/api/ShapeProvider";

export function num(spec: ShapeSpec, k: string, dflt = 0): number {
  const raw = spec.attrs.get(k);
  if (raw === undefined) return dflt;
  if (!isNumericLiteral(raw))
    throw new ModelError(`invalid number for ${k}: ${raw}`);
  return Number(raw);
}

export function spec(pairs: [string, string][], text?: string): ShapeSpec {
  return { attrs: new Map(pairs), text };
}

/**
 * 把位置参数按 schema 收成属性表。
 * 必填不足或超出（必填 + 可选）都报 `wrong number of arguments`，
 * CreateCommand 靠这条固定文案判断能否回退到 "in" 子句解析。
 */
export function take(args: string[], names: string[], optional: string[] = []): ShapeSpec {
  const total = names.length + optional.length;
  if (args.length < names.length || args.length > total)
    throw new ModelError("wrong number of arguments");
  const pairs: [string, string][] = names.map((n, i) => [n, args[i]]);
  optional.forEach((n, k) => {
    const v = args[names.length + k];
    if (v !== undefined) pairs.push([n, v]);
  });
  return spec(pairs);
}
