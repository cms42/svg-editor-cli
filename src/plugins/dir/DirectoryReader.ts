/**
 * 目录访问接口（适配器模式中的 **Target**）：
 * 命令逻辑只认识这个接口，不认识 fs。
 */
export interface DirectoryEntry {
  readonly name: string;
  /** 目录、普通文件以外的特殊项（符号链接等）按 isDirectory 的判定归组。 */
  readonly isDirectory: boolean;
}

export interface DirectoryReader {
  /**
   * 列出目录的直接子项（含隐藏项，不含 `.` / `..`）。
   * 读取失败抛 DirectoryReadError。
   */
  list(path: string): DirectoryEntry[];
}

export class DirectoryReadError extends Error {
  constructor(readonly path: string) {
    super(`cannot read directory: ${path}`);
    this.name = "DirectoryReadError";
  }
}
