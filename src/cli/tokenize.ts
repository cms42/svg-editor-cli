/**
 * 命令行 tokenizer：空白分隔，双引号包裹带空格的参数（引号被剥掉）。
 * 不支持转义；未闭合引号报错。
 */
export function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const n = line.length;
  while (i < n) {
    while (i < n && /\s/.test(line[i])) i++;
    if (i >= n) break;
    if (line[i] === '"') {
      const end = line.indexOf('"', i + 1);
      if (end < 0) throw new TokenizeError("unterminated quote");
      tokens.push(line.slice(i + 1, end));
      i = end + 1;
    } else {
      let j = i;
      while (j < n && !/\s/.test(line[j])) j++;
      tokens.push(line.slice(i, j));
      i = j;
    }
  }
  return tokens;
}

export class TokenizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenizeError";
  }
}
