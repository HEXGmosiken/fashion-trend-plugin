import test from "node:test";
import assert from "node:assert/strict";
import { canonicalUrl, dedupeEvidence, inWindow, jaccard, normalizeTitle, titleTokens } from "../src/core/normalize.ts";
import type { Evidence, Source } from "../src/core/schema.ts";
import { EvidenceSchema } from "../src/core/schema.ts";

const src: Source = {
  id: "s1",
  name: "Demo",
  domain: "demo.example",
  publisherGroup: "g1",
  language: "en",
  region: "global",
  type: "media",
  tier: 2,
  paywall: false,
  crawlable: true,
};
const other: Source = { ...src, id: "s2", publisherGroup: "g2" };
const sources = new Map([[src.id, src], [other.id, other]]);

function ev(partial: Partial<Evidence> & { id: string }): Evidence {
  return EvidenceSchema.parse({
    sourceId: "s1",
    url: "https://demo.example/a",
    title: "Some trend report",
    publishedAt: "2026-02-01",
    accessedAt: "2026-11-01",
    season: "FW26",
    window: "A",
    excerpt: "这是一段足够长的原文摘录，用于测试。",
    ...partial,
  });
}

test("canonicalUrl 去掉 hash、utm 并排序参数", () => {
  const a = canonicalUrl("https://Demo.example/p?b=2&utm_source=x&a=1#frag");
  const b = canonicalUrl("https://demo.example/p?a=1&b=2");
  assert.equal(a, b);
});

test("canonicalUrl 保留有意义的 query", () => {
  assert.match(canonicalUrl("https://demo.example/p?id=7&utm_medium=x"), /id=7/);
  assert.equal(
    canonicalUrl("https://demo.example/p/?id=7&utm_medium=x"),
    canonicalUrl("https://demo.example/p?id=7"),
  );
});

test("标题归一化抹平标点与大小写", () => {
  assert.equal(normalizeTitle("The Top Trends: Spring 2027!"), "the top trends spring 2027");
});

test("jaccard 相同标题为 1", () => {
  assert.equal(jaccard(titleTokens("a b c"), titleTokens("a b c")), 1);
});

test("同 URL 判为重复", () => {
  const items = [ev({ id: "1" }), ev({ id: "2" })];
  const { unique, duplicates } = dedupeEvidence(items, new Map([["s1", src]]));
  assert.equal(unique.length, 1);
  assert.equal(duplicates[0]!.reason, "same-url");
});

test("独立原创优先于先录入的品牌稿及转载，保留台账顺序", () => {
  const brand = { ...src, id: "brand", type: "brand" } satisfies Source;
  const items = [
    ev({ id: "brand", sourceId: brand.id }),
    ev({ id: "unrelated", url: "https://demo.example/independent", title: "Autumn fabric feature" }),
    ev({ id: "reprint", originality: "reprint" }),
    ev({ id: "original" }),
  ];
  const { unique, duplicates } = dedupeEvidence(items, new Map([...sources, [brand.id, brand]]));
  assert.deepEqual(unique.map(({ id }) => id), ["unrelated", "original"]);
  assert.deepEqual(duplicates.map(({ id, duplicateOf }) => [id, duplicateOf]), [
    ["reprint", "original"],
    ["brand", "original"],
  ]);
});

test("同 publisher group 的近似标题判为重复", () => {
  const items = [
    ev({ id: "1", url: "https://demo.example/a", title: "Spring 2027 runway trends" }),
    ev({ id: "2", url: "https://demo.example/b", title: "Spring 2027 runway trends" }),
  ];
  const { duplicates } = dedupeEvidence(items, new Map([["s1", src]]));
  assert.equal(duplicates[0]!.reason, "same-publisher");
});

test("不同 publisher group 同标题判为转载", () => {
  const items = [
    ev({ id: "1", url: "https://demo.example/a", title: "Spring 2027 runway trends" }),
    ev({ id: "2", sourceId: "s2", url: "https://other.example/b", title: "Spring 2027 runway trends", originality: "reprint" }),
  ];
  const { duplicates } = dedupeEvidence(items, sources);
  assert.equal(duplicates[0]!.reason, "cross-publisher");
});

test("同集团归并先于跨集团标题去重", () => {
  const items = [
    ev({ id: "1", sourceId: "s2", url: "https://other.example/a" }),
    ev({ id: "2", url: "https://demo.example/b", originality: "reprint" }),
    ev({ id: "3", url: "https://demo.example/c", originality: "reprint" }),
  ];
  const { duplicates } = dedupeEvidence(items, sources);
  assert.deepEqual(duplicates.map(({ id, duplicateOf, reason }) => [id, duplicateOf, reason]), [
    ["3", "2", "same-publisher"],
    ["2", "1", "cross-publisher"],
  ]);
});

test("主题季明显冲突时仅凭同标题不合并", () => {
  const items = [
    ev({ id: "1", season: "FW26" }),
    ev({ id: "2", url: "https://demo.example/b", season: "SS27" }),
  ];
  assert.equal(dedupeEvidence(items, sources).duplicates.length, 0);
});

test("去重阈值含边界，低于阈值不合并", () => {
  for (const { sourceId, total, same, reason } of [
    { sourceId: "s1", total: 20, same: 17, reason: "same-publisher" },
    { sourceId: "s2", total: 25, same: 23, reason: "cross-publisher" },
  ]) {
    const words = Array.from({ length: total }, (_, i) => `term${i}`);
    const base = ev({ id: "1", title: words.join(" ") });
    for (const count of [same - 1, same]) {
      const candidate = ev({
        id: "2",
        sourceId,
        title: words.slice(0, count).join(" "),
        url: "https://other.example/b",
        originality: "reprint",
      });
      const { duplicates } = dedupeEvidence([base, candidate], sources);
      assert.equal(duplicates[0]?.reason, count === same ? reason : undefined);
      if (count === same) assert.equal(duplicates[0]?.similarity, same / total);
    }
  }
});

test("文字分词为空不能触发去重", () => {
  const items = [
    ev({ id: "1", title: "a b –" }),
    ev({ id: "2", url: "https://demo.example/b", title: "c d –" }),
  ];
  assert.equal(dedupeEvidence(items, sources).duplicates.length, 0);
});

test("时间窗包含首日和末日", () => {
  const start = "2026-02-01";
  const end = "2026-02-02";
  assert.equal(inWindow("2026-01-31", start, end), false);
  assert.equal(inWindow(start, start, end), true);
  assert.equal(inWindow(end, start, end), true);
  assert.equal(inWindow("2026-02-03", start, end), false);
});
