import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dedupeEvidence, jaccard, titleTokens } from "../src/core/normalize.ts";
import { EvidenceSchema, SourceSchema, type Evidence } from "../src/core/schema.ts";
import type { DuplicateHit } from "../src/core/types.ts";

type PairLabel = DuplicateHit["reason"] | null;
interface ArticleMetadata {
  title: string;
  url: string;
  group: string;
  season: Evidence["season"];
  originality?: Evidence["originality"];
}
interface CalibrationPair {
  id: string;
  label: PairLabel;
  match: PairLabel;
  a: ArticleMetadata;
  b: ArticleMetadata;
}

const pairs: CalibrationPair[] = JSON.parse(readFileSync(
  new URL("./fixtures/dedup-calibration.json", import.meta.url),
  "utf8",
));

test("公开服装媒体样本复测三层去重", (t) => {
  const found = { hits: 0, misses: 0, falsePositives: 0, independent: 0 };
  for (const pair of pairs) {
    const evidence = [pair.a, pair.b].map((article, i) => EvidenceSchema.parse({
      id: `e${i}`,
      sourceId: `s${i}`,
      url: article.url,
      title: article.title,
      // 仅回放标题、URL、主题季与来源配置，日期和摘录不参与本样本的相似度计算。
      publishedAt: "2026-10-01",
      accessedAt: "2026-11-21",
      season: article.season,
      window: "X",
      excerpt: "用于复测标题和链接的占位文本。",
      originality: article.originality,
    }));
    const sources = new Map([pair.a, pair.b].map((article, i) => {
      const source = SourceSchema.parse({
        id: `s${i}`,
        name: article.group,
        domain: new URL(article.url).hostname,
        publisherGroup: article.group,
        language: "other",
        type: "media",
        tier: 2,
      });
      return [source.id, source] as const;
    }));
    const match = dedupeEvidence(evidence, sources).duplicates[0]?.reason ?? null;
    const score = jaccard(titleTokens(pair.a.title), titleTokens(pair.b.title));
    t.diagnostic(`${pair.id}: score=${score.toFixed(3)}, label=${pair.label}, match=${match}`);
    assert.equal(match, pair.match, pair.id);
    if (pair.label === null) {
      if (match !== null) found.falsePositives++;
      else found.independent++;
    } else if (match === pair.label) {
      found.hits++;
    } else {
      found.misses++;
    }
  }
  assert.deepEqual(found, { hits: 6, misses: 4, falsePositives: 0, independent: 6 });
});
