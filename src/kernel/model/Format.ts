/** 数字格式化：整数不带小数点，浮点保留必要精度。 */
export function fmt(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return parseFloat(n.toFixed(6)).toString();
}

const NUMERIC = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/** 严格数字字面量校验：拒绝 NaN/Infinity/十六进制/空串等。 */
export function isNumericLiteral(raw: string): boolean {
  if (!NUMERIC.test(raw.trim())) return false;
  return Number.isFinite(Number(raw));
}
