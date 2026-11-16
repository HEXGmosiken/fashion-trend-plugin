/**
 * 结论层：把「编码好的证据」算成可复算的结论。
 *
 * 三条硬规则：
 * 1. 只有 codings 里明确为 true/false 的证据进分母，未编码的既不算支持也不算反对；
 * 2. 样本量低于 minN 不出结论，只出「证据不足」；
 * 3. 置信度只看样本量、区间重叠、效应量、同源占比，不看文字写得多漂亮。
 */
import type { Claim, Evidence } from "./schema.ts";
import { ci, compareProportions, pct, proportion } from "./metrics.ts";
import type { Confidence, Finding, Proportion } from "./types.ts";

const UNIT_LABEL: Record<Claim["unit"], string> = {
  show: "场秀",
  look: "个造型",
  article: "篇报道",
  product: "个商品",
};

/** 取布尔编码；缺失或非布尔一律返回 null（不进分母） */
export function readCoding(ev: Evidence, key: string): boolean | null {
  const v = ev.codings[key];
  return typeof v === "boolean" ? v : null;
}

function collect(evidence: Evidence[], claim: Claim, window: "A" | "B") {
  const truthy: string[] = [];
  const falsy: string[] = [];
  let missing = 0;
  for (const ev of evidence) {
    if (ev.window !== window) continue;
    const v = readCoding(ev, claim.signal);
    if (v === null) {
      missing++;
      continue;
    }
    (v ? truthy : falsy).push(ev.id);
  }
  return { truthy, falsy, missing, prop: proportion([...truthy.map(() => true), ...falsy.map(() => false)]) };
}

function decideConfidence(
  cmp: ReturnType<typeof compareProportions>,
  minN: number,
  reprintShare: number,
  directionMatches: boolean,
): Confidence {
  const enough = cmp.a.n >= minN && cmp.b.n >= minN;
  const effect = Math.abs(cmp.deltaPp) >= 5;
  if (!enough || !directionMatches) return "low";
  if (!cmp.ciOverlap && effect && reprintShare <= 0.3) return "high";
  if (effect) return "medium";
  return "low";
}

export function buildFinding(
  claim: Claim,
  evidence: Evidence[],
  opts: { reprintShare: number; counterLimit?: number } = { reprintShare: 0 },
): Finding {
  const a = collect(evidence, claim, "A");
  const b = collect(evidence, claim, "B");
  const cmp = compareProportions(a.prop, b.prop);
  const counterLimit = opts.counterLimit ?? 8;

  const directionMatches =
    claim.direction === "change"
      ? Math.abs(cmp.deltaPp) >= 1
      : claim.direction === "up"
        ? cmp.deltaPp > 0
        : cmp.deltaPp < 0;

  const confidence = decideConfidence(cmp, claim.minN, opts.reprintShare, directionMatches);

  // 反证 = 与预期相反的那一侧证据：旧窗口里已经存在 + 新窗口里缺席
  const counterPool: string[] =
    claim.direction === "down"
      ? [...b.truthy, ...a.falsy] // 判断为下降时，「B 里仍有」「A 里没有」都算反证
      : [...a.truthy, ...b.falsy];
  const counter = counterPool.slice(0, counterLimit);

  const label = claim.signalLabel || claim.signal;
  const unit = UNIT_LABEL[claim.unit];
  const magnitude = Math.abs(cmp.deltaPp);
  const trend =
    magnitude < 1
      ? "基本持平"
      : cmp.deltaPp > 0
        ? `上升 ${magnitude} 个百分点`
        : `下降 ${magnitude} 个百分点`;

  const statement =
    `以「${unit}」为分析单位，${label}在${claim.windowB.label}的占比为 ${pct(b.prop.share)}` +
    `（${b.prop.k}/${b.prop.n}，95% CI ${ci(b.prop)}），` +
    `相比${claim.windowA.label}的 ${pct(a.prop.share)}（${a.prop.k}/${a.prop.n}，95% CI ${ci(a.prop)}）` +
    `${trend}；两组置信区间${cmp.ciOverlap ? "重叠" : "不重叠"}。`;

  const caveats: string[] = [];
  caveats.push(
    `样本量：${claim.windowA.label} n=${a.prop.n}、${claim.windowB.label} n=${b.prop.n}，门槛 minN=${claim.minN}。`,
  );
  if (a.missing + b.missing > 0) {
    caveats.push(`${a.missing + b.missing} 条证据未编码「${claim.signal}」，已从分母剔除。`);
  }
  if (cmp.ciOverlap) {
    caveats.push("置信区间重叠：方向可以参考，幅度不能当成精确值。");
  }
  if (opts.reprintShare > 0.3) {
    caveats.push(`同源/转载证据占比 ${(opts.reprintShare * 100).toFixed(0)}%，样本独立性不足。`);
  }
  if (!directionMatches) {
    caveats.push(`实测方向与命题假设（${claim.direction}）相反，结论按反方向解读。`);
  }
  if (counterPool.length > counterLimit) {
    caveats.push(`反证共 ${counterPool.length} 条，此处只列前 ${counterLimit} 条。`);
  }
  if (claim.counterNote) {
    caveats.push(`已知反证/替代解释：${claim.counterNote}`);
  }
  caveats.push("结论只覆盖已编码样本，不外推到未采样品牌与市场。");

  // 支撑 = 与结论方向一致的证据：上升看新窗口里出现了什么，下降看新窗口里缺席了什么
  const support =
    claim.direction === "up"
      ? b.truthy
      : claim.direction === "down"
        ? b.falsy
        : [...b.truthy, ...b.falsy];

  return {
    claimId: claim.id,
    question: claim.question,
    statement,
    direction: claim.direction,
    confidence,
    comparison: cmp,
    support: support.slice(0, 200),
    counter,
    caveats,
  };
}

export function buildFindings(
  claims: Claim[],
  evidence: Evidence[],
  reprintShareByClaim: Map<string, number>,
): Finding[] {
  return claims.map((c) =>
    buildFinding(c, evidence, { reprintShare: reprintShareByClaim.get(c.id) ?? 0 }),
  );
}

export function emptyProportion(): Proportion {
  return { n: 0, k: 0, share: 0, ciLow: 0, ciHigh: 1 };
}
