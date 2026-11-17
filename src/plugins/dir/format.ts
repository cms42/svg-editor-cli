import type { DirectoryEntry } from "./DirectoryReader";

/**
 * 目录列表的纯渲染：给定条目集合，产出稳定顺序的文本行。
 * 与文件系统、与 CLI 都无关，可独立测试。
 *
 * 排序规则：目录在前、文件在后，各组按名称升序（按码位比较，与 locale 无关），
 * 因此同一输入永远得到逐字节一致的输出。
 */
export function renderDirectoryListing(entries: readonly DirectoryEntry[]): string[] {
  if (entries.length === 0) return ["(empty directory)"];
  const dirs = entries.filter((e) => e.isDirectory).map((e) => e.name);
  const files = entries.filter((e) => !e.isDirectory).map((e) => e.name);
  dirs.sort(compareNames);
  files.sort(compareNames);
  const lines: string[] = [];
  for (const name of dirs) lines.push(`[DIR]  ${name}`);
  for (const name of files) lines.push(`[FILE] ${name}`);
  return lines;
}

function compareNames(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
