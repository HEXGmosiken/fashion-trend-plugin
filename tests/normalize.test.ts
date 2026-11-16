import test from "node:test";
import assert from "node:assert/strict";
import { canonicalUrl, dedupeEvidence, jaccard, normalizeTitle, titleTokens } from "../src/core/normalize.ts";
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

test("同 publisher group 的近似标题判为重复", () => {
  const items = [
    ev({ id: "1", url: "https://demo.example/a", title: "Spring 2027 runway trends" }),
    ev({ id: "2", url: "https://demo.example/b", title: "Spring 2027 runway trends" }),
  ];
  const { duplicates } = dedupeEvidence(items, new Map([["s1", src]]));
  assert.equal(duplicates[0]!.reason, "same-publisher");
});

test("不同 publisher group 同标题判为转载", () => {
  const other: Source = { ...src, id: "s2", publisherGroup: "g2" };
  const items = [
    ev({ id: "1", url: "https://demo.example/a", title: "Spring 2027 runway trends" }),
    ev({ id: "2", sourceId: "s2", url: "https://other.example/b", title: "Spring 2027 runway trends" }),
  ];
  const { duplicates } = dedupeEvidence(items, new Map([["s1", src], ["s2", other]]));
  assert.equal(duplicates[0]!.reason, "cross-publisher");
});
