import { ModelError } from "../model/Shape";
import type { Shape } from "../model/Shape";
import type { ShapeCreateContext, ShapeProvider, ShapeSpec } from "../api/ShapeProvider";

/**
 * 扩展点 1 的注册表：类型名 → provider，另按读回标签名建索引。
 *
 * 全系统只有这里与 CommandRegistry 是"按名字查表"，但两者都只是查注册表；
 * 内核代码里没有任何 switch(类型名) 的分支。
 */
export class ShapeRegistry {
  private readonly providers = new Map<string, ShapeProvider>();
  private readonly byTag = new Map<string, ShapeProvider[]>();

  register(provider: ShapeProvider): void {
    this.providers.set(provider.type, provider);
    for (const tag of provider.readTags ?? [provider.type]) {
      const list = this.byTag.get(tag) ?? [];
      if (!list.includes(provider)) list.push(provider);
      this.byTag.set(tag, list);
    }
  }

  get(type: string): ShapeProvider | undefined {
    return this.providers.get(type);
  }

  types(): string[] {
    return [...this.providers.keys()];
  }

  /** 读回时按标签名找 provider（data-kind 缺省或未识别时用）。 */
  providerForTag(tag: string): ShapeProvider | undefined {
    return this.byTag.get(tag)?.[0];
  }

  usage(type: string): string | null {
    return this.providers.get(type)?.usage ?? null;
  }

  parse(type: string, args: string[]): ShapeSpec {
    const p = this.providers.get(type);
    if (!p) throw new ModelError(`unknown shape type: ${type} (is the plugin loaded?)`);
    return p.parse(args);
  }

  create(type: string, id: string, spec: ShapeSpec, ctx: ShapeCreateContext): Shape {
    const p = this.providers.get(type);
    if (!p) throw new ModelError(`unknown shape type: ${type} (is the plugin loaded?)`);
    const shape = p.create(id, spec, ctx);
    shape.initStyle(
      spec.attrs.get("fill") ?? null,
      spec.attrs.get("stroke") ?? null,
      spec.attrs.get("stroke-width") ?? null
    );
    return shape;
  }
}
