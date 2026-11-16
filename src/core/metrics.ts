/** 统计层：只做可复算的算术，不做解释。 */
import type { Comparison, Proportion } from "./types.ts";

/** Wilson 95% 置信区间：小样本下比正态近似稳，n=0 时返回全区间 */
export function wilson(k: number, n: number, z = 1.96): { share: number; ciLow: number; ciHigh: number } {
  if (n <= 0) return { share: 0, ciLow: 0, ciHigh: 1 };
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return {
    share: p,
    ciLow: Math.max(0, centre - margin),
    ciHigh: Math.min(1, centre + margin),
  };
}

export function proportion(flags: boolean[]): Proportion {
  const n = flags.length;
  const k = flags.filter(Boolean).length;
  const { share, ciLow, ciHigh } = wilson(k, n);
  return { n, k, share, ciLow, ciHigh };
}

export function compareProportions(a: Proportion, b: Proportion): Comparison {
  const ciOverlap = a.ciLow <= b.ciHigh && b.ciLow <= a.ciHigh;
  const deltaPp = Number(((b.share - a.share) * 100).toFixed(1));
  const relative = a.share === 0 ? null : Number(((b.share - a.share) / a.share).toFixed(3));
  return { a, b, deltaPp, relative, ciOverlap };
}

/** 百分比展示，固定 1 位小数 */
export function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

/** 置信区间展示 */
export function ci(p: { ciLow: number; ciHigh: number }): string {
  return `${(p.ciLow * 100).toFixed(1)}–${(p.ciHigh * 100).toFixed(1)}%`;
}
