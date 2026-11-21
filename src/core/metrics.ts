/** 统计层：只做可复算的算术，不做解释。 */
import type { Comparison, Proportion } from "./types.ts";

/** Wilson 95% 置信区间：小样本下比正态近似稳，n=0 时返回全区间 */
export function wilson(k: number, n: number, z = 1.96): { share: number; ciLow: number; ciHigh: number } {
  if (!Number.isSafeInteger(k) || !Number.isSafeInteger(n) || k < 0 || n < k) {
    throw new RangeError("Wilson 区间要求 0 ≤ k ≤ n，且 k、n 都是安全整数");
  }
  const z2 = z * z;
  if (z < 0 || !Number.isFinite(z2)) throw new RangeError("Wilson 区间要求 z 为有限非负数");
  if (n === 0) return { share: 0, ciLow: 0, ciHigh: 1 };
  const p = k / n;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return {
    share: p,
    ciLow: k === 0 ? 0 : Math.max(0, centre - margin),
    ciHigh: k === n ? 1 : Math.min(1, centre + margin),
  };
}

export function proportion(flags: boolean[]): Proportion {
  const n = flags.length;
  const k = flags.filter(Boolean).length;
  const { share, ciLow, ciHigh } = wilson(k, n);
  return { n, k, share, ciLow, ciHigh };
}

/** 先用计数通分，再换算百分点，避免在取整或浮点相减后做阈值判定。 */
export function proportionDeltaPp(a: Proportion, b: Proportion): number {
  if (a.n === 0 || b.n === 0) return (b.share - a.share) * 100;
  return ((b.k * a.n - a.k * b.n) * 100) / (a.n * b.n);
}

export function compareProportions(a: Proportion, b: Proportion): Comparison {
  const ciOverlap = a.ciLow <= b.ciHigh && b.ciLow <= a.ciHigh;
  const change = proportionDeltaPp(a, b);
  const deltaPp = Number(change.toFixed(1)) || 0;
  const relative = a.share === 0 ? null : Number((change / (100 * a.share)).toFixed(3)) || 0;
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
