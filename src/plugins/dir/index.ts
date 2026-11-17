import { Action, CommandError } from "../../kernel/api/Command";
import type { PluginModule } from "../../kernel/api/Plugin";
import { DirectoryReadError } from "./DirectoryReader";
import type { DirectoryReader } from "./DirectoryReader";
import { FsDirectoryReader } from "./FsDirectoryReader";
import { renderDirectoryListing } from "./format";

/**
 * `dir`：列出 CLI 进程当前工作目录的直接子项。
 *
 * 命令类只依赖 DirectoryReader（Target 接口），
 * 真实实现 FsDirectoryReader 由装配处注入，测试可换成替身。
 * 不依赖 SVG 文档，也不改变文档、dirty 状态或 undo/redo 历史。
 */
export class DirAction implements Action {
  constructor(
    private readonly args: string[],
    private readonly reader: DirectoryReader,
    private readonly cwd: string
  ) {
    if (args.length !== 0) throw new CommandError("usage: dir");
  }

  run(): string[] {
    try {
      const entries = this.reader.list(this.cwd);
      // 复制一份，避免渲染函数改动调用方数据
      return renderDirectoryListing([...entries]);
    } catch (e) {
      if (e instanceof DirectoryReadError) throw new CommandError(e.message);
      throw e;
    }
  }
}

/** 插件默认用真实文件系统；装配处可通过 options.reader 注入替身。 */
const plugin: PluginModule = {
  name: "@svgframe/plugin-dir",
  contributes: { commands: ["dir"] },
  activate(ctx) {
    const injected = ctx.options["reader"];
    const reader: DirectoryReader =
      isReader(injected) ? injected : new FsDirectoryReader();
    ctx.registerCommand("dir", (c, a) => new DirAction(a, reader, c.cwd), {
      section: "display",
      line: "  dir                                       list files and folders in the working directory",
    });
  },
};

function isReader(v: unknown): v is DirectoryReader {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as DirectoryReader).list === "function"
  );
}

export default plugin;
export { renderDirectoryListing };
export type { DirectoryReader, DirectoryEntry } from "./DirectoryReader";
