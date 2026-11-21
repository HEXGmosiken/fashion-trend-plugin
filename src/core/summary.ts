/**
 * 总述：论点由人写，数据由书算。
 * 这里只做两件事——把人工论点接到趋势上，把趋势的样本数填进数据行。
 */
import type { Trend, TrendBook } from "./render/magazine.ts";

export interface RawSummary {
  season: string;
  thesis: string;
  paragraphs: { title: string; claim: string; refs: string[] }[];
  counter: { claim: string; refs: string[] };
  close: string;
}

export interface SummaryBlock {
  title: string;
  claim: string;
  /** 形如「刺绣 17 篇 34% · 蕾丝 22 篇 44%」 */
  data: string;
  missing: string[];
}

export interface SummaryModel {
  season: string;
  thesis: string;
  blocks: SummaryBlock[];
  counter: SummaryBlock;
  close: string;
}

function dataLine(trendsByName: Map<string, Trend>, refs: string[]): { data: string; missing: string[] } {
  const parts: string[] = [];
  const missing: string[] = [];
  for (const name of new Set(refs.map((ref) => ref.trim()))) {
    const t = trendsByName.get(name);
    if (typeof t?.docs !== "number" || !Number.isSafeInteger(t.docs) || t.docs < 0) {
      missing.push(name);
      continue;
    }
    const share = t.share;
    const percent = typeof share === "number" && Number.isFinite(share) && share >= 0 && share <= 100
      ? ` ${share}%`
      : "";
    parts.push(`${name} ${t.docs} 篇${percent}`);
  }
  return { data: parts.join(" · "), missing };
}

export function buildSummary(book: TrendBook, raw: RawSummary): SummaryModel {
  const trendsByName = new Map(book.trends.map((trend) => [trend.name, trend]));
  const toBlock = (p: { title: string; claim: string; refs: string[] }): SummaryBlock => {
    const { data, missing } = dataLine(trendsByName, p.refs);
    return { title: p.title, claim: p.claim, data, missing };
  };

  return {
    season: raw.season,
    thesis: raw.thesis,
    blocks: raw.paragraphs.map(toBlock),
    counter: toBlock({ title: "反证", ...raw.counter }),
    close: raw.close,
  };
}
