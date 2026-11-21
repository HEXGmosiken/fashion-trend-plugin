/** 报告组装：去重 → 指标 → 结论 → 审计，一条流水线。 */
import type { Claim, Evidence, Source } from "./schema.ts";
import { dedupeEvidence } from "./normalize.ts";
import { buildFindings } from "./findings.ts";
import { sampleExclusions } from "./eligibility.ts";
import { runAudit, summarize } from "./audit.ts";
import type { Report, ReportMeta } from "./types.ts";

export interface BuildArgs {
  claims: Claim[];
  evidence: Evidence[];
  sources: Source[];
  dataset: string;
  synthetic: boolean;
  notes?: string;
  title?: string;
  inputs: ReportMeta["inputs"];
  today?: string;
}

/** 每个命题里「同源 / 转载 / 非原创」证据的占比，用于置信度折价 */
function reprintShareByClaim(
  claims: Claim[],
  evidence: Evidence[],
  duplicateIds: Set<string>,
  sourcesById: ReadonlyMap<string, Source>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of claims) {
    const pool = evidence.filter((e) =>
      typeof e.codings[c.signal] === "boolean" && sampleExclusions(e, c, sourcesById).length === 0,
    );
    const tainted = pool.filter((e) => e.originality !== "original" || duplicateIds.has(e.id));
    out.set(c.id, pool.length ? tainted.length / pool.length : 0);
  }
  return out;
}

export function buildReport(args: BuildArgs): Report {
  const sourcesById = new Map(args.sources.map((s) => [s.id, s]));
  const { unique, duplicates } = dedupeEvidence(args.evidence, sourcesById);
  const duplicateIds = new Set(duplicates.map((d) => d.id));

  const findings = buildFindings(
    args.claims,
    unique,
    reprintShareByClaim(args.claims, args.evidence, duplicateIds, sourcesById),
    sourcesById,
  );

  const audit = runAudit({
    evidence: unique,
    rawEvidence: args.evidence,
    claims: args.claims,
    findings,
    sources: args.sources,
    sourcesById,
    duplicates,
    today: args.today,
  });
  const s = summarize(audit);

  return {
    meta: {
      title: args.title ?? "服装趋势分析报告",
      dataset: args.dataset,
      synthetic: args.synthetic,
      notes: args.notes ?? "",
      generatedAt: new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
      tool: "trend-lab 0.1.0",
      inputs: args.inputs,
    },
    claims: args.claims,
    findings,
    evidence: unique,
    sources: args.sources,
    duplicates,
    audit,
    stats: {
      evidence: args.evidence.length,
      unique: unique.length,
      duplicates: duplicates.length,
      sources: new Set(unique.map((e) => e.sourceId)).size,
      publisherGroups: new Set(
        unique.map((e) => sourcesById.get(e.sourceId)?.publisherGroup ?? e.sourceId),
      ).size,
      errors: s.errors,
      warnings: s.warnings,
    },
  };
}
