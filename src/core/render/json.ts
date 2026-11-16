/** JSON 渲染：给主项目 / 下游程序调用。字段即契约。 */
import type { Report } from "../types.ts";

export function renderJson(r: Report): string {
  return JSON.stringify(r, null, 2) + "\n";
}
