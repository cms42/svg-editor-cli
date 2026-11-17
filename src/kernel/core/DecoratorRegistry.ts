import type { TreeDecorator, TreeDecoratorFactory } from "../api/TreeDecorator";

/**
 * 扩展点 3 的注册表。
 *
 * 保存的是**工厂**，但在 `register` 时就实例化：装饰器需要尽早订阅
 * 文档事件（如 init/read/save）才能建立正确的基线，晚到一步就会漏事件。
 * 每个编辑器会话一套注册表，因此实例天然是"每会话一份"，不需要模块级变量。
 */
export class DecoratorRegistry {
  private readonly factories = new Map<string, TreeDecoratorFactory>();
  private readonly instances = new Map<string, TreeDecorator>();

  register(name: string, factory: TreeDecoratorFactory): void {
    this.factories.set(name, factory);
    this.instances.set(name, factory());
  }

  names(): string[] {
    return [...this.factories.keys()];
  }

  /** 按注册顺序返回实例。 */
  all(): readonly TreeDecorator[] {
    return [...this.instances.values()];
  }
}
