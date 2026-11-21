/**
 * 结论层：把「编码好的证据」算成可复算的结论。
 *
 * 三条硬规则：
 * 1. 只有 codings 里明确为 true/false 的证据进分母，未编码的既不算支持也不算反对；
 * 2. 样本量低于 minN 不出结论，只出「证据不足」；
 * 3. 置信度只看样本量、区间重叠、效应量、同源占比，不看文字写得多漂亮。
 */
import { hasFrozenCodingRule, type Claim, type Evidence, type Source } from "./schema.ts";
import { sampleExclusions } from "./eligibility.ts";
import { ci, compareProportions, pct, proportion, proportionDeltaPp } from "./metrics.ts";
import type { Confidence, Finding, Proportion } from "./types.ts";

export const UNIT_LABEL: Record<Claim["unit"], string> = {
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
  ciOverlap: boolean,
  deltaPp: number,
  reprintShare: number,
  directionMatches: boolean,
): Confidence {
  if (!directionMatches || Math.abs(deltaPp) < 5) return "low";
  return !ciOverlap && reprintShare <= 0.3 ? "high" : "medium";
}

export function buildFinding(
  claim: Claim,
  evidence: Evidence[],
  opts: { reprintShare: number; counterLimit?: number; sourcesById?: ReadonlyMap<string, Source> } = { reprintShare: 0 },
): Finding {
  const sample = evidence.filter((ev) => sampleExclusions(ev, claim, opts.sourcesById).length === 0);
  const a = collect(sample, claim, "A");
  const b = collect(sample, claim, "B");
  const cmp = compareProportions(a.prop, b.prop);
  const deltaPp = proportionDeltaPp(a.prop, b.prop);
  const counterLimit = opts.counterLimit ?? 8;
  const sampleLine = `样本量为 ${claim.windowA.label} ${a.prop.n}、${claim.windowB.label} ${b.prop.n}，每窗至少需要 ${claim.minN}。`;

  const caveats = [sampleLine];
  if (a.missing + b.missing > 0) {
    caveats.push(`${a.missing + b.missing} 条证据未编码「${claim.signal}」，已从分母剔除。`);
  }
  if (claim.counterNote) caveats.push(`已知反证或替代解释为${claim.counterNote}`);
  const base = {
    claimId: claim.id,
    question: claim.question,
    direction: claim.direction,
    comparison: cmp,
    caveats,
  };

  if (!hasFrozenCodingRule(claim.codingRule)) {
    return {
      ...base,
      status: "unfrozen-rule",
      confidence: "low",
      statement: "编码规则尚未冻结，暂缓结论。",
      support: [],
      counter: [],
    };
  }
  if (a.prop.n < claim.minN || b.prop.n < claim.minN) {
    return {
      ...base,
      status: "insufficient-sample",
      confidence: "low",
      statement: `证据不足，暂缓结论。${sampleLine}`,
      support: [],
      counter: [],
    };
  }

  const observedDirection = deltaPp > 0 ? "up" : deltaPp < 0 ? "down" : "flat";
  const directionMatches =
    claim.direction === "change"
      ? Math.abs(deltaPp) >= 1
      : claim.direction === observedDirection;
  const confidence = decideConfidence(cmp.ciOverlap, deltaPp, opts.reprintShare, directionMatches);

  // 单向命题按预设方向列证据，双向命题按观测方向列证据。
  const evidenceDirection = claim.direction === "change" ? observedDirection : claim.direction;
  const counterPool: string[] =
    evidenceDirection === "down"
      ? [...b.truthy, ...a.falsy]
      : evidenceDirection === "up"
        ? [...a.truthy, ...b.falsy]
        : [];
  const counter = counterPool.slice(0, counterLimit);

  const label = claim.signalLabel || claim.signal;
  const unit = UNIT_LABEL[claim.unit];
  const magnitude = Math.abs(cmp.deltaPp);
  const trend =
    Math.abs(deltaPp) < 1
      ? "基本持平"
      : cmp.deltaPp > 0
        ? `上升 ${magnitude} 个百分点`
        : `下降 ${magnitude} 个百分点`;

  const statement =
    `以「${unit}」为分析单位，${label}在${claim.windowB.label}的占比为 ${pct(b.prop.share)}` +
    `（${b.prop.k}/${b.prop.n}，95% CI ${ci(b.prop)}），` +
    `相比${claim.windowA.label}的 ${pct(a.prop.share)}（${a.prop.k}/${a.prop.n}，95% CI ${ci(a.prop)}）` +
    `${trend}。两组置信区间${cmp.ciOverlap ? "重叠" : "不重叠"}。`;

  if (cmp.ciOverlap) {
    caveats.push("两组置信区间重叠，变化幅度的估计存在不确定性。");
  }
  if (opts.reprintShare > 0.3) {
    caveats.push(`同源/转载证据占比 ${(opts.reprintShare * 100).toFixed(0)}%，样本独立性不足。`);
  }
  if (!directionMatches) {
    caveats.push("实测变化未达到命题预设的方向条件。");
  } else if (Math.abs(deltaPp) < 5) {
    caveats.push("按原始计数计算的变化幅度低于 5 个百分点。");
  }
  if (counterPool.length > counterLimit) {
    caveats.push(`反证共 ${counterPool.length} 条，此处只列前 ${counterLimit} 条。`);
  }
  caveats.push("结论只覆盖已编码样本，不外推到未采样品牌与市场。");

  // 支撑 = 与结论方向一致的证据：上升看新窗口里出现了什么，下降看新窗口里缺席了什么
  const support =
    evidenceDirection === "up"
      ? b.truthy
      : evidenceDirection === "down"
        ? b.falsy
        : [...b.truthy, ...b.falsy];

  return {
    ...base,
    statement,
    confidence,
    support: support.slice(0, 200),
    counter,
  };
}

export function buildFindings(
  claims: Claim[],
  evidence: Evidence[],
  reprintShareByClaim: ReadonlyMap<string, number>,
  sourcesById?: ReadonlyMap<string, Source>,
): Finding[] {
  return claims.map((c) =>
    buildFinding(c, evidence, { reprintShare: reprintShareByClaim.get(c.id) ?? 0, sourcesById }),
  );
}

export function emptyProportion(): Proportion {
  return { n: 0, k: 0, share: 0, ciLow: 0, ciHigh: 1 };
}
