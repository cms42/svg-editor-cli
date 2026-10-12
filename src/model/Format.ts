/** 数字格式化：整数不带小数点，浮点保留必要精度。 */
export function fmt(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return parseFloat(n.toFixed(6)).toString();
}
