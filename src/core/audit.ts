/**
 * 审计层：对应任务的第 5 条「逐条检查报告」。
 * 这里只做机器能判定的检查；判断类问题（描述是否与原图一致）仍要人看。
 */
import { isPromotional, sampleExclusions, type SampleExclusion } from "./eligibility.ts";
import { readCoding } from "./findings.ts";
import { hasFrozenCodingRule, type Claim, type Evidence, type Source } from "./schema.ts";
import type { AuditIssue, DuplicateHit, Finding } from "./types.ts";

const SUGGESTIONS = {
  E_UNKNOWN_SOURCE: "在来源注册表补登记该来源，或更正证据的 sourceId。",
  W_FUTURE_DATE: "回到原文核对发布日期，确认后更新台账。",
  I_DATE_ESTIMATED: "找到原文发布日期后更正日期并取消估算标记。",
  W_ACCESS_BEFORE_PUBLISH: "核对抓取日和发布日期，并修正填错的一项。",
  E_SEASON_MISMATCH: "核对原文主题季和手工窗口标记，按命题口径重新归类。",
  W_SHORT_EXCERPT: "补录支持当前编码的完整原文句子，保留复核所需的上下文。",
  I_DUP_URL: "保留同一链接的一条权威记录，并核对保留记录的编码。",
  W_DUP_TITLE: "打开两个原文核实是否为转载或版本重复。若确为不同文章，记录复核依据。",
  E_UNFROZEN_RULE: "先写清计为 true、false 和保留未编码的条件，再编码样本并重跑。",
  W_NO_SCOPE: "写明机器可检查的品牌或来源类型，并在解读中列明实际样本范围。",
  W_SMALL_N: "按同一口径补齐两窗的独立样本，达到 minN 后重跑。",
  E_NO_SUPPORT: "核查编码与引用，确认有合格的支撑证据后再发布结论。",
  I_CI_OVERLAP: "报告两窗的样本量及区间，将差异幅度作为描述性结果。",
  E_DANGLING_REF: "将引用改为去重后台账所保留的正确证据编号。",
  W_SPONSORED_IN_SUPPORT: "将品牌稿和投放内容转入背景材料，用符合口径的独立来源替换。",
  W_TIER3_DOMINANT: "补充一手资料或专业媒体来源，并标注各层级来源的占比。",
  W_SAMPLE_OUT_OF_SCOPE: "核对证据的品牌和来源类型。只有在重新冻结采样口径后才能调整允许范围。",
  E_SAMPLE_OUT_OF_SCOPE: "移除越界引用，按已冻结的品牌与来源类型重新统计。",
  W_WINDOW_MISMATCH: "核对发布日期、主题季与窗口，重新归类后再统计。",
  E_WINDOW_MISMATCH: "移除错配引用并核对证据窗口。归入 X 的资料只作背景。",
  W_PROMO_EXCLUDED: "保留投放标记或品牌来源类型，将内容用于背景说明。",
  E_UNKNOWN_CLAIM: "补充对应的命题或修正结论关联的 claimId。",
  E_UNCODED_REF: "核对原文后补做布尔编码，或移除此条引用。",
} as const;

const REASON_LABEL: Record<SampleExclusion, string> = {
  window: "标为背景窗 X",
  season: "主题季错配",
  date: "发布日期越界",
  brand: "品牌越界",
  sourceType: "来源类型越界",
  unknownSource: "来源未登记",
  advertising: "品牌稿或投放",
};

const describe = (reasons: SampleExclusion[]) => reasons.map((reason) => REASON_LABEL[reason]).join("、");
const scopeReasons = (reasons: SampleExclusion[]) =>
  reasons.filter((reason) => reason === "brand" || reason === "sourceType");
const windowReasons = (reasons: SampleExclusion[]) =>
  reasons.filter((reason) => reason === "window" || reason === "season" || reason === "date");

export interface AuditContext {
  evidence: Evidence[];
  /** 去重前的原始条目，用于核查字段与候选样本。结论引用须指向保留条目。 */
  rawEvidence?: Evidence[];
  claims: Claim[];
  findings: Finding[];
  sources: Source[];
  sourcesById: Map<string, Source>;
  duplicates: DuplicateHit[];
  today?: string;
}

export function runAudit(ctx: AuditContext): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const emit = (code: keyof typeof SUGGESTIONS, level: AuditIssue["level"], message: string, refs: string[]) => {
    issues.push({ level, code, message, refs, suggestion: SUGGESTIONS[code] });
  };
  const today = ctx.today ?? new Date().toISOString().slice(0, 10);
  const byId = new Map(ctx.evidence.map((e) => [e.id, e]));
  const claimsById = new Map(ctx.claims.map((claim) => [claim.id, claim]));
  const seasons = {
    A: new Set(ctx.claims.map((claim) => claim.windowA.season)),
    B: new Set(ctx.claims.map((claim) => claim.windowB.season)),
  };

  for (const ev of ctx.rawEvidence ?? ctx.evidence) {
    const src = ctx.sourcesById.get(ev.sourceId);
    if (!src) {
      emit("E_UNKNOWN_SOURCE", "error", `证据 ${ev.id} 的 sourceId「${ev.sourceId}」不在来源注册表里`, [ev.id]);
    }
    if (ev.publishedAt > today) {
      emit("W_FUTURE_DATE", "warn", `证据 ${ev.id} 的发布日期 ${ev.publishedAt} 晚于今天`, [ev.id]);
    }
    if (ev.dateEstimated) {
      emit("I_DATE_ESTIMATED", "info", `证据 ${ev.id} 的发布日期为估算值（原文未标注）`, [ev.id]);
    }
    if (ev.accessedAt < ev.publishedAt) {
      emit("W_ACCESS_BEFORE_PUBLISH", "warn", `证据 ${ev.id} 的抓取日早于发布日期`, [ev.id]);
    }
    if (ev.window !== "X" && !seasons[ev.window].has(ev.season)) {
      const allowed = [...seasons[ev.window]].join("/");
      emit("E_SEASON_MISMATCH", "error",
        `证据 ${ev.id} 的主题季 ${ev.season} 与窗口 ${ev.window} 的主题季（${allowed}）不符`, [ev.id]);
    }
    if (ev.excerpt.trim().length < 20) {
      emit("W_SHORT_EXCERPT", "warn", `证据 ${ev.id} 的原文摘录过短（${ev.excerpt.trim().length} 字）`, [ev.id]);
    }

    if (ev.window === "X") continue;
    const candidates = ctx.claims.filter((claim) => readCoding(ev, claim.signal) !== null);
    if (candidates.length > 0 && isPromotional(ev, src)) {
      emit("W_PROMO_EXCLUDED", "warn", `证据 ${ev.id} 属于品牌稿或投放内容，已排除在命题样本之外`, [ev.id]);
    }
    for (const claim of candidates) {
      const reasons = sampleExclusions(ev, claim, ctx.sourcesById);
      const scope = scopeReasons(reasons);
      if (scope.length > 0) {
        emit("W_SAMPLE_OUT_OF_SCOPE", "warn",
          `证据 ${ev.id} 已从命题 ${claim.id} 的候选样本剔除（${describe(scope)}）`, [claim.id, ev.id]);
      }
      const window = windowReasons(reasons);
      if (window.length > 0) {
        emit("W_WINDOW_MISMATCH", "warn",
          `证据 ${ev.id} 已从命题 ${claim.id} 的候选样本剔除（窗口 ${ev.window}，${describe(window)}）`, [claim.id, ev.id]);
      }
    }
  }

  for (const d of ctx.duplicates) {
    const level = d.reason === "cross-publisher" ? "warn" : "info";
    emit(d.reason === "same-url" ? "I_DUP_URL" : "W_DUP_TITLE", level,
      `证据 ${d.id} 与 ${d.duplicateOf} 重复（${d.reason}，相似度 ${d.similarity}），已剔除`, [d.id, d.duplicateOf]);
  }

  for (const claim of ctx.claims) {
    if (!hasFrozenCodingRule(claim.codingRule)) {
      emit("E_UNFROZEN_RULE", "error", `命题 ${claim.id} 没有有效的编码规则，结论已暂停`, [claim.id]);
    }
    if (claim.sampleScope.brands.length === 0 && claim.sampleScope.sourceTypes.length === 0) {
      emit("W_NO_SCOPE", "warn", `命题 ${claim.id} 未限定品牌和来源类型`, [claim.id]);
    }
  }

  for (const f of ctx.findings) {
    const claim = claimsById.get(f.claimId);
    if (!claim) {
      emit("E_UNKNOWN_CLAIM", "error", `结论 ${f.claimId} 关联的命题不存在`, [f.claimId]);
      continue;
    }
    if (f.comparison.a.n < claim.minN || f.comparison.b.n < claim.minN) {
      emit("W_SMALL_N", "warn",
        `命题 ${claim.id} 样本不足（A 窗 ${f.comparison.a.n}，B 窗 ${f.comparison.b.n}，各窗至少需要 ${claim.minN}）`, [claim.id]);
    }
    const { n, k } = f.comparison.b;
    const noPositiveSupport = claim.direction === "up" && k === 0;
    const noNegativeSupport = claim.direction === "down" && k === n;
    const counterOnly = n > 0 && f.counter.length > 0 && (noPositiveSupport || noNegativeSupport);
    if (!f.status && f.support.length === 0 && !counterOnly) {
      emit("E_NO_SUPPORT", "error", `结论 ${claim.id} 缺少可复核的支撑引用`, [claim.id]);
    }
    if (f.comparison.a.n > 0 && f.comparison.b.n > 0 && f.comparison.ciOverlap) {
      emit("I_CI_OVERLAP", "info", `命题 ${claim.id} 的两组 Wilson 区间重叠`, [claim.id]);
    }
    for (const id of new Set([...f.support, ...f.counter])) {
      const ev = byId.get(id);
      const refs = [claim.id, id];
      if (!ev) {
        emit("E_DANGLING_REF", "error", `结论 ${claim.id} 引用了去重后不存在的证据 ${id}`, refs);
        continue;
      }
      const reasons = sampleExclusions(ev, claim, ctx.sourcesById);
      const scope = scopeReasons(reasons);
      if (scope.length > 0) {
        emit("E_SAMPLE_OUT_OF_SCOPE", "error", `结论 ${claim.id} 的引用 ${id} 超出采样口径（${describe(scope)}）`, refs);
      }
      const window = windowReasons(reasons);
      if (window.length > 0) {
        emit("E_WINDOW_MISMATCH", "error", `结论 ${claim.id} 的引用 ${id} 与时间窗口径不符（${describe(window)}）`, refs);
      }
      if (readCoding(ev, claim.signal) === null) {
        emit("E_UNCODED_REF", "error", `结论 ${claim.id} 的引用 ${id} 缺少信号「${claim.signal}」的布尔编码`, refs);
      }
    }
    const sponsored = [...new Set(f.support)].filter((id) => {
      const ev = byId.get(id);
      return ev && isPromotional(ev, ctx.sourcesById.get(ev.sourceId));
    });
    if (sponsored.length > 0) {
      emit("W_SPONSORED_IN_SUPPORT", "warn",
        `结论 ${claim.id} 的支撑证据里有 ${sponsored.length} 条品牌稿或投放内容`, [claim.id, ...sponsored]);
    }
  }

  const tier3 = ctx.evidence.filter((e) => (ctx.sourcesById.get(e.sourceId)?.tier ?? 3) === 3);
  if (ctx.evidence.length > 0 && tier3.length / ctx.evidence.length > 0.5) {
    const share = ((tier3.length / ctx.evidence.length) * 100).toFixed(0);
    emit("W_TIER3_DOMINANT", "warn", `三级来源及未登记来源合计占 ${share}%`, []);
  }

  return issues;
}

export function summarize(issues: AuditIssue[]) {
  return {
    errors: issues.filter((i) => i.level === "error").length,
    warnings: issues.filter((i) => i.level === "warn").length,
    infos: issues.filter((i) => i.level === "info").length,
  };
}

export function formatIssues(issues: AuditIssue[]): string {
  const icon = { error: "✗", warn: "!", info: "·" } as const;
  return issues
    .map((i) => `${icon[i.level]} [${i.code}] ${i.message}${i.suggestion ? `。处理建议　${i.suggestion}` : ""}`)
    .join("\n");
}
