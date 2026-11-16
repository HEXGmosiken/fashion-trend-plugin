/**
 * 展示层模型：把分析结果翻译成「趋势报告」的语言。
 *
 * 三条硬规则：
 * 1. 主视图不出现工程词（CI、pp、medium、publisher group），它们只进附录；
 * 2. 数字不做括号嵌套，占比取整，变化用「点」而不是个百分点；
 * 3. 中文是正文语言，英文只用于季节代码、品牌名、色号、趋势代号。
 */
import type { Claim, DeckConfig, Evidence, Palette, Source } from "./schema.ts";
import type { Confidence, Finding, Report } from "./types.ts";

export type { DeckConfig, Palette };

export const DEFAULT_PALETTE: Palette = { paper: "#F5F2EC", accent: "#8A6A3B", ink: "#221F1A" };

const FALLBACK: Palette[] = [
  { paper: "#EDF1F3", accent: "#4F7484", ink: "#18262C" },
  { paper: "#F4EEE4", accent: "#8A6A3B", ink: "#241E17" },
  { paper: "#EEEDEA", accent: "#4A5058", ink: "#1E2024" },
];

/** 整数百分比：主视图只用这个 */
export function pctInt(x: number): number {
  return Math.round(x * 100);
}

/** 变化方向与文案：从取整后的两个占比算，保证图上加减自洽 */
export function deltaText(a: number, b: number): { text: string; dir: "up" | "down" | "flat" } {
  const d = b - a;
  if (Math.abs(d) <= 1) return { text: "基本持平", dir: "flat" };
  return d > 0 ? { text: `高出 ${d} 点`, dir: "up" } : { text: `低 ${Math.abs(d)} 点`, dir: "down" };
}

export function confidenceDots(c: Confidence): number {
  return c === "high" ? 3 : c === "medium" ? 2 : 1;
}

export function confidenceLabel(c: Confidence): string {
  return c === "high" ? "高" : c === "medium" ? "中" : "低";
}

export function confidenceHint(c: Confidence): string {
  if (c === "high") return "样本充足，两季区间不重叠";
  if (c === "medium") return "区间有重叠，方向可参考，幅度不稳";
  return "差异落在误差范围内，不能当作趋势";
}

/** 结论句：不带括号、不带英文缩写 */
export function statementLines(
  title: string,
  a: number,
  b: number,
  nA: number,
  nB: number,
  kA: number,
  kB: number,
  conf: Confidence,
): string[] {
  const d = deltaText(a, b);
  let first: string;
  if (d.dir === "up") first = `${title}在两季报道里的出现率从 ${a}% 升到 ${b}%，高出 ${Math.abs(b - a)} 点。`;
  else if (d.dir === "down") first = `${title}在两季报道里的出现率从 ${a}% 降到 ${b}%，低了 ${Math.abs(b - a)} 点。`;
  else first = `${title}在两季报道里的出现率分别是 ${a}% 和 ${b}%，基本持平。`;

  const lines = [
    first,
    `2027 春夏的 ${nB} 篇报道里有 ${kB} 篇提到它，2026 秋冬是 ${nA} 篇里 ${kA} 篇。`,
  ];
  if (conf === "high") lines.push("方向明确，幅度也可以直接引用。");
  else if (conf === "medium") lines.push("方向可以看，具体幅度不要当成精确值。");
  else lines.push("这个差距在误差范围内，只能当作待观察。");
  return lines;
}

export interface DeckPage {
  no: string;
  claimId: string;
  title: string;
  kwA: string;
  kwB: string;
  lines: string[];
  shareA: number;
  shareB: number;
  nA: number;
  nB: number;
  kA: number;
  kB: number;
  delta: { text: string; dir: "up" | "down" | "flat" };
  confidence: Confidence;
  dots: number;
  confLabel: string;
  confHint: string;
  evidenceCount: number;
  sourceCount: number;
  caveats: string[];
  support: { title: string; source: string; date: string; url: string }[];
  counterCount: number;
  palette: Palette;
}

export interface DeckModel {
  seasonLabel: string;
  seasonCode: string;
  periodLabel: string;
  coverTitle: string;
  coverSub: string;
  synthetic: boolean;
  generatedAt: string;
  pages: DeckPage[];
  totals: { evidence: number; sources: number; findings: number; duplicates: number };
  audit: { errors: number; warnings: number };
  appendix: {
    claims: Claim[];
    evidence: Evidence[];
    sources: Source[];
    notes: string;
  };
}

export function buildDeck(r: Report, cfg: DeckConfig): DeckModel {
  const evById = new Map(r.evidence.map((e) => [e.id, e]));
  const srcName = (id: string) => r.sources.find((s) => s.id === id)?.name ?? id;

  const pages = r.findings.map((f, i) => {
    const claim = r.claims.find((c) => c.id === f.claimId)!;
    const c = cfg.claims[f.claimId];
    const palette = c?.palette ?? FALLBACK[i % FALLBACK.length] ?? DEFAULT_PALETTE;
    const title = c?.title ?? claim.signalLabel ?? claim.signal;

    const shareA = pctInt(f.comparison.a.share);
    const shareB = pctInt(f.comparison.b.share);
    const delta = deltaText(shareA, shareB);

    const support = f.support
      .slice(0, 40)
      .map((id) => evById.get(id))
      .filter((e): e is Evidence => !!e)
      .map((e) => ({
        title: e.title,
        source: srcName(e.sourceId),
        date: e.publishedAt,
        url: e.url,
      }));

    const sourceCount = new Set(
      f.support.map((id) => evById.get(id)?.sourceId).filter(Boolean),
    ).size;

    const caveats: string[] = [`样本 ${f.comparison.a.n} 篇对 ${f.comparison.b.n} 篇`];
    if (f.comparison.ciOverlap) caveats.push("区间重叠，幅度不作准");
    if (f.confidence !== "high") caveats.push(confidenceHint(f.confidence));

    return {
      no: String(i + 1).padStart(2, "0"),
      claimId: f.claimId,
      title,
      kwA: c?.kwA ?? "",
      kwB: c?.kwB ?? "",
      lines: statementLines(title, shareA, shareB, f.comparison.a.n, f.comparison.b.n, f.comparison.a.k, f.comparison.b.k, f.confidence),
      shareA,
      shareB,
      nA: f.comparison.a.n,
      nB: f.comparison.b.n,
      kA: f.comparison.a.k,
      kB: f.comparison.b.k,
      delta,
      confidence: f.confidence,
      dots: confidenceDots(f.confidence),
      confLabel: confidenceLabel(f.confidence),
      confHint: confidenceHint(f.confidence),
      evidenceCount: f.support.length,
      sourceCount,
      caveats,
      support,
      counterCount: f.counter.length,
      palette,
    } satisfies DeckPage;
  });

  return {
    seasonLabel: cfg.seasonLabel,
    seasonCode: cfg.seasonCode,
    periodLabel: cfg.periodLabel,
    coverTitle: cfg.coverTitle,
    coverSub: cfg.coverSub,
    synthetic: r.meta.synthetic,
    generatedAt: r.meta.generatedAt,
    pages,
    totals: {
      evidence: r.stats.unique,
      sources: r.stats.sources,
      findings: r.findings.length,
      duplicates: r.stats.duplicates,
    },
    audit: { errors: r.stats.errors, warnings: r.stats.warnings },
    appendix: {
      claims: r.claims,
      evidence: r.evidence,
      sources: r.sources,
      notes: r.meta.notes,
    },
  };
}

/** 置信度小圆点，供 HTML 直接使用 */
export function dotGlyphs(n: number): string[] {
  return [1, 2, 3].map((i) => (i <= n ? "●" : "○"));
}

export type { Finding };
