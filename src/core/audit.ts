/**
 * 审计层：对应任务的第 5 条「逐条检查报告」。
 * 这里只做机器能判定的检查；判断类问题（描述是否与原图一致）仍要人看。
 */
import type { Claim, Evidence, Source } from "./schema.ts";
import { impliedWindow } from "./normalize.ts";
import type { AuditIssue, DuplicateHit, Finding } from "./types.ts";

export interface AuditContext {
  evidence: Evidence[];
  claims: Claim[];
  findings: Finding[];
  sources: Source[];
  sourcesById: Map<string, Source>;
  duplicates: DuplicateHit[];
  today?: string;
}

export function runAudit(ctx: AuditContext): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const today = ctx.today ?? new Date().toISOString().slice(0, 10);
  const byId = new Map(ctx.evidence.map((e) => [e.id, e]));

  for (const ev of ctx.evidence) {
    const src = ctx.sourcesById.get(ev.sourceId);
    if (!src) {
      issues.push({
        level: "error",
        code: "E_UNKNOWN_SOURCE",
        message: `证据 ${ev.id} 的 sourceId「${ev.sourceId}」不在来源注册表里`,
        refs: [ev.id],
      });
    }
    if (ev.publishedAt > today) {
      issues.push({
        level: "warn",
        code: "W_FUTURE_DATE",
        message: `证据 ${ev.id} 的发布日期 ${ev.publishedAt} 晚于今天`,
        refs: [ev.id],
      });
    }
    if (ev.dateEstimated) {
      issues.push({
        level: "info",
        code: "I_DATE_ESTIMATED",
        message: `证据 ${ev.id} 的发布日期为估算值（原文未标注）`,
        refs: [ev.id],
      });
    }
    if (ev.accessedAt < ev.publishedAt) {
      issues.push({
        level: "warn",
        code: "W_ACCESS_BEFORE_PUBLISH",
        message: `证据 ${ev.id} 的抓取日早于发布日期`,
        refs: [ev.id],
      });
    }
    if (ev.window !== "X") {
      const allowed = new Set<string>();
      for (const c of ctx.claims) {
        allowed.add(ev.window === "A" ? c.windowA.season : c.windowB.season);
      }
      if (!allowed.has(ev.season)) {
        issues.push({
          level: "error",
          code: "E_SEASON_MISMATCH",
          message: `证据 ${ev.id} 归入窗口 ${ev.window}，但 season ${ev.season} 与窗口主题季（${[...allowed].join("/")}）不一致`,
          refs: [ev.id],
        });
      }
    }
    if (ev.excerpt.trim().length < 20) {
      issues.push({
        level: "warn",
        code: "W_SHORT_EXCERPT",
        message: `证据 ${ev.id} 的原文摘录过短（${ev.excerpt.trim().length} 字），难以复核`,
        refs: [ev.id],
      });
    }
  }

  for (const d of ctx.duplicates) {
    const level = d.reason === "cross-publisher" ? "warn" : "info";
    issues.push({
      level,
      code: d.reason === "same-url" ? "I_DUP_URL" : "W_DUP_TITLE",
      message: `证据 ${d.id} 与 ${d.duplicateOf} 重复（${d.reason}，相似度 ${d.similarity}），已剔除`,
      refs: [d.id, d.duplicateOf],
    });
  }

  for (const claim of ctx.claims) {
    if (!claim.codingRule.trim()) {
      issues.push({
        level: "error",
        code: "E_UNFROZEN_RULE",
        message: `命题 ${claim.id} 没有冻结编码规则，不允许出结论`,
        refs: [claim.id],
      });
    }
    if (claim.sampleScope.brands.length === 0 && claim.sampleScope.sourceTypes.length === 0) {
      issues.push({
        level: "warn",
        code: "W_NO_SCOPE",
        message: `命题 ${claim.id} 未限定样本范围，结论容易被当成「全市场」`,
        refs: [claim.id],
      });
    }
  }

  for (const f of ctx.findings) {
    const claim = ctx.claims.find((c) => c.id === f.claimId)!;
    if (f.comparison.a.n < claim.minN || f.comparison.b.n < claim.minN) {
      issues.push({
        level: "warn",
        code: "W_SMALL_N",
        message: `结论 ${f.claimId} 样本不足（${f.comparison.a.n}/${f.comparison.b.n} < minN ${claim.minN}），只能作为线索`,
        refs: [f.claimId],
      });
    }
    if (f.support.length === 0) {
      issues.push({
        level: "error",
        code: "E_NO_SUPPORT",
        message: `结论 ${f.claimId} 没有任何支撑证据`,
        refs: [f.claimId],
      });
    }
    if (f.comparison.ciOverlap) {
      issues.push({
        level: "info",
        code: "I_CI_OVERLAP",
        message: `结论 ${f.claimId} 的置信区间重叠，幅度不宜精确表述`,
        refs: [f.claimId],
      });
    }
    for (const id of f.support) {
      if (!byId.has(id)) {
        issues.push({
          level: "error",
          code: "E_DANGLING_REF",
          message: `结论 ${f.claimId} 引用了不存在的证据 ${id}`,
          refs: [f.claimId, id],
        });
      }
    }
    for (const id of f.counter) {
      if (!byId.has(id)) {
        issues.push({
          level: "error",
          code: "E_DANGLING_REF",
          message: `结论 ${f.claimId} 的反证引用了不存在的证据 ${id}`,
          refs: [f.claimId, id],
        });
      }
    }
    const sponsored = f.support
      .map((id) => byId.get(id))
      .filter((e): e is Evidence => !!e && e.isSponsored);
    if (sponsored.length > 0) {
      issues.push({
        level: "warn",
        code: "W_SPONSORED_IN_SUPPORT",
        message: `结论 ${f.claimId} 的支撑证据里有 ${sponsored.length} 条品牌投放内容`,
        refs: sponsored.map((e) => e.id),
      });
    }
  }

  const tier3 = ctx.evidence.filter((e) => (ctx.sourcesById.get(e.sourceId)?.tier ?? 3) === 3);
  if (ctx.evidence.length > 0 && tier3.length / ctx.evidence.length > 0.5) {
    issues.push({
      level: "warn",
      code: "W_TIER3_DOMINANT",
      message: `三级来源（门户/自媒体/聚合）占 ${((tier3.length / ctx.evidence.length) * 100).toFixed(0)}%，证据层级偏低`,
      refs: [],
    });
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
    .map((i) => `${icon[i.level]} [${i.code}] ${i.message}`)
    .join("\n");
}
