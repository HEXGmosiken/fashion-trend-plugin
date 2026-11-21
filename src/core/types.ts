/** 输出层的类型（指标 / 结论 / 审计 / 报告）。输入层的类型在 schema.ts。 */
import type { Claim, Evidence, Source } from "./schema.ts";

export interface Proportion {
  /** 分母：编码了该信号的证据条数 */
  n: number;
  /** 分子：编码为 true 的证据条数 */
  k: number;
  share: number;
  ciLow: number;
  ciHigh: number;
}

export interface Comparison {
  a: Proportion;
  b: Proportion;
  /** B - A，单位：百分点 */
  deltaPp: number;
  /** 相对变化，(B-A)/A；A 为 0 时 null */
  relative: number | null;
  ciOverlap: boolean;
}

export type Confidence = "high" | "medium" | "low";

export interface Finding {
  claimId: string;
  question: string;
  statement: string;
  /** 分析暂停原因。此时只保留可审计的样本统计。 */
  status?: "insufficient-sample" | "unfrozen-rule";
  direction: "up" | "down" | "change";
  confidence: Confidence;
  comparison: Comparison;
  /** 支撑结论的证据 id */
  support: string[];
  /** 反证证据 id（与结论方向相反的证据） */
  counter: string[];
  caveats: string[];
}

export interface AuditIssue {
  level: "error" | "warn" | "info";
  code: string;
  message: string;
  suggestion?: string;
  refs: string[];
}

export interface DuplicateHit {
  id: string;
  duplicateOf: string;
  reason: "same-url" | "same-publisher" | "cross-publisher";
  similarity: number;
}

export interface ReportMeta {
  title: string;
  dataset: string;
  synthetic: boolean;
  notes: string;
  generatedAt: string;
  tool: string;
  inputs: { evidence: string; claims: string; sources: string };
}

export interface Report {
  meta: ReportMeta;
  claims: Claim[];
  findings: Finding[];
  evidence: Evidence[];
  sources: Source[];
  duplicates: DuplicateHit[];
  audit: AuditIssue[];
  stats: {
    evidence: number;
    unique: number;
    duplicates: number;
    sources: number;
    publisherGroups: number;
    errors: number;
    warnings: number;
  };
}

export interface AnalysisInput {
  claims: Claim[];
  evidence: Evidence[];
  sources: Source[];
  sourcesById: Map<string, Source>;
  duplicates: DuplicateHit[];
}

/** 报告入口页的数据 */
export interface SiteEntry {
  /** 相对 reports/ 的目录名，例如 auto */
  dir: string;
  kicker: string;
  title: string;
  desc: string;
  stats: string;
  files: string[];
  /** 生成时间，展示用 */
  at: string;
}

export interface SiteData {
  title: string;
  entries: SiteEntry[];
}
