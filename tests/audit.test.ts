import assert from "node:assert/strict";
import test from "node:test";
import { formatIssues, runAudit } from "../src/core/audit.ts";
import { sampleExclusions } from "../src/core/eligibility.ts";
import { compareProportions, proportion } from "../src/core/metrics.ts";
import type { Claim, Evidence, Source } from "../src/core/schema.ts";
import type { Finding } from "../src/core/types.ts";

const claim: Claim = {
  id: "claim-sheer",
  question: "薄纱提及率是否上升？",
  signal: "sheer",
  signalLabel: "薄纱",
  unit: "article",
  windowA: { label: "秋冬", season: "FW26", start: "2026-09-01", end: "2026-10-31" },
  windowB: { label: "春夏", season: "SS27", start: "2026-10-01", end: "2026-11-30" },
  direction: "up",
  minN: 1,
  sampleScope: { brands: ["Example Brand"], sourceTypes: ["media", "brand"], include: [], exclude: [] },
  codingRule: "仅当正文明确把薄纱描述为趋势时记为真，其余已核对样本记为假。",
  counterNote: "",
};

const media: Source = {
  id: "media",
  name: "Media",
  domain: "media.example",
  publisherGroup: "media",
  language: "en",
  type: "media",
  tier: 2,
  region: "global",
  paywall: false,
  crawlable: true,
};

const brand: Source = { ...media, id: "brand", type: "brand" };
const shop: Source = { ...media, id: "shop", type: "commerce" };
const sources = [media, brand, shop];
const sourcesById = new Map(sources.map((source) => [source.id, source]));

function entry(id: string, overrides: Partial<Evidence> = {}): Evidence {
  return {
    id,
    sourceId: media.id,
    title: "The Season's Runway Report",
    url: `https://media.example/${id}`,
    publishedAt: "2026-10-01",
    dateEstimated: false,
    accessedAt: "2026-12-01",
    season: "SS27",
    window: "B",
    brand: "Example Brand",
    category: "",
    excerpt: "The writers described sheer layers as a major theme.",
    originality: "original",
    isSponsored: false,
    codings: { sheer: true },
    ...overrides,
  };
}

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    claimId: claim.id,
    question: claim.question,
    statement: "",
    support: [],
    counter: [],
    comparison: compareProportions(proportion([false]), proportion([true])),
    confidence: "medium",
    direction: "up",
    caveats: [],
    ...overrides,
  };
}

test("采样允许两个窗口日期重叠，按所标窗口同时检查端点和主题季", () => {
  assert.deepEqual(sampleExclusions(entry("start", { brand: "Ｅxample   BRAND" }), claim, sourcesById), []);
  assert.deepEqual(sampleExclusions(entry("end", { publishedAt: "2026-11-30" }), claim, sourcesById), []);
  assert.deepEqual(sampleExclusions(entry("overlap", { window: "A", season: "FW26" }), claim, sourcesById), []);
  assert.deepEqual(sampleExclusions(entry("wrong-season", { season: "FW26" }), claim, sourcesById), ["season"]);
  assert.deepEqual(sampleExclusions(entry("early", { publishedAt: "2026-09-30" }), claim, sourcesById), ["date"]);
  assert.deepEqual(sampleExclusions(entry("late", { publishedAt: "2026-12-01" }), claim, sourcesById), ["date"]);
  assert.deepEqual(sampleExclusions(entry("background", { window: "X" }), claim, sourcesById), ["window"]);
});

test("审计识别候选样本越界、窗口错配、含投放的支撑和无效引用", () => {
  const rows = [
    entry("wrong-brand", { brand: "Outside Brand", codings: { sheer: false } }),
    entry("wrong-type", { sourceId: shop.id }),
    entry("wrong-date", { publishedAt: "2026-09-30" }),
    entry("paid", { isSponsored: true }),
    entry("press-release", { sourceId: brand.id }),
    entry("outside", { window: "X" }),
    entry("uncoded", { codings: { sheer: "true" } }),
    entry("valid"),
  ];
  const issues = runAudit({
    evidence: rows,
    claims: [claim],
    findings: [finding({
      support: ["wrong-brand", "wrong-type", "paid", "press-release", "valid"],
      counter: ["outside", "wrong-date", "uncoded", "absent"],
    })],
    sources,
    sourcesById,
    duplicates: [],
    today: "2026-12-01",
  });
  const refs = (code: string) => issues.filter((issue) => issue.code === code).map((issue) => issue.refs);
  assert.deepEqual(refs("W_SAMPLE_OUT_OF_SCOPE"), [[claim.id, "wrong-brand"], [claim.id, "wrong-type"]]);
  assert.deepEqual(refs("E_SAMPLE_OUT_OF_SCOPE"), refs("W_SAMPLE_OUT_OF_SCOPE"));
  assert.deepEqual(refs("W_WINDOW_MISMATCH"), [[claim.id, "wrong-date"]]);
  assert.deepEqual(refs("E_WINDOW_MISMATCH"), [[claim.id, "outside"], [claim.id, "wrong-date"]]);
  assert.deepEqual(refs("W_PROMO_EXCLUDED"), [["paid"], ["press-release"]]);
  assert.deepEqual(refs("W_SPONSORED_IN_SUPPORT"), [[claim.id, "paid", "press-release"]]);
  assert.deepEqual(refs("E_UNCODED_REF"), [[claim.id, "uncoded"]]);
  assert.deepEqual(refs("E_DANGLING_REF"), [[claim.id, "absent"]]);
  assert.ok(issues.every((issue) => issue.suggestion?.length));
  assert.match(formatIssues(issues), /\[W_SAMPLE_OUT_OF_SCOPE\].*处理建议/);
});

test("样本不足不要求支撑，去重剔除的条目仍接受原始台账校验", () => {
  const retained = entry("retained");
  const duplicate = entry("removed", { url: retained.url, sourceId: "missing-source" });
  const issues = runAudit({
    evidence: [retained],
    rawEvidence: [retained, duplicate],
    claims: [claim],
    findings: [finding({
      status: "insufficient-sample",
      comparison: compareProportions(proportion([]), proportion([true])),
    })],
    sources,
    sourcesById,
    duplicates: [{ id: duplicate.id, duplicateOf: retained.id, reason: "same-url", similarity: 1 }],
    today: "2026-12-01",
  });
  assert.deepEqual(issues.map((issue) => issue.code), ["E_UNKNOWN_SOURCE", "I_DUP_URL", "W_SMALL_N"]);
});
