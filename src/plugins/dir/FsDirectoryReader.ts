import * as fs from "fs";
import { DirectoryEntry, DirectoryReadError, DirectoryReader } from "./DirectoryReader";

/**
 * 真实文件系统适配器（适配器模式中的 **Adapter**）。
 * 把 `fs.readdirSync(withFileTypes)` 的形状适配成 DirectoryReader 契约：
 * - 只看直接子项，不递归；
 * - 含隐藏项，剔除 `.` / `..`；
 * - 不跟随符号链接（阅读目标由使用者决定，这里只报告它是目录还是文件）。
 */
export class FsDirectoryReader implements DirectoryReader {
  list(path: string): DirectoryEntry[] {
    let dirents: fs.Dirent[];
    try {
      dirents = fs.readdirSync(path, { withFileTypes: true });
    } catch {
      throw new DirectoryReadError(path);
    }
    const out: DirectoryEntry[] = [];
    for (const d of dirents) {
      if (d.name === "." || d.name === "..") continue;
      out.push({ name: d.name, isDirectory: d.isDirectory() });
    }
    return out;
  }
}
