/**
 * 总述：论点由人写，数据由书算。
 * 这里只做两件事——把人工论点接到趋势上，把趋势的样本数填进数据行。
 */
import type { TrendBook } from "./render/magazine.ts";

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

function dataLine(book: TrendBook, refs: string[]): { data: string; missing: string[] } {
  const parts: string[] = [];
  const missing: string[] = [];
  for (const name of refs) {
    const t = book.trends.find((x) => x.name === name);
    if (!t || typeof t.docs !== "number") {
      missing.push(name);
      continue;
    }
    parts.push(`${name} ${t.docs} 篇 ${t.share ?? "?"}%`);
  }
  return { data: parts.join(" · "), missing };
}

export function buildSummary(book: TrendBook, raw: RawSummary): SummaryModel {
  const toBlock = (p: { title: string; claim: string; refs: string[] }): SummaryBlock => {
    const { data, missing } = dataLine(book, p.refs);
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
