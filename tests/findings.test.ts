import test from "node:test";
import assert from "node:assert/strict";
import { buildFinding } from "../src/core/findings.ts";
import { buildDeck } from "../src/core/present.ts";
import { renderDeck } from "../src/core/render/deck.ts";
import { renderMarkdown } from "../src/core/render/markdown.ts";
import { buildReport } from "../src/core/report.ts";
import { DeckConfigSchema, type Claim, type Evidence, type Source } from "../src/core/schema.ts";

const claim: Claim = {
  id: "test",
  question: "春夏报道中的薄纱提及率是否上升？",
  signal: "sheer",
  signalLabel: "薄纱",
  unit: "article",
  windowA: { label: "对照期", season: "FW26", start: "2026-09-01", end: "2026-09-30" },
  windowB: { label: "观察期", season: "SS27", start: "2026-09-01", end: "2026-09-30" },
  direction: "up",
  minN: 20,
  sampleScope: { brands: [], sourceTypes: ["media"], include: [], exclude: [] },
  codingRule: "文章正文实质讨论薄纱的造型作用时记为 true，仅在图注提到时记为 false。",
  counterNote: "较暖天气可能增加薄纱讨论。",
};

function items(window: "A" | "B", k: number, n: number): Evidence[] {
  return Array.from({ length: n }, (_, index) => {
    const id = `${window}${index}`;
    return {
      id,
      sourceId: "media",
      title: `时装报道 ${id}`,
      url: `https://media.example/${id}`,
      publishedAt: window === "A" ? claim.windowA.start : claim.windowB.end,
      accessedAt: "2026-10-01",
      dateEstimated: false,
      season: window === "A" ? "FW26" : "SS27",
      window,
      brand: "",
      category: "",
      excerpt: `供统计测试的合成报道 ${id}，这段摘录含二十字以上的测试文字。`,
      originality: "original",
      isSponsored: false,
      codings: { sheer: index < k },
    };
  });
}

function reportFor(evidence: Evidence[]) {
  const source: Source = {
    id: "media", name: "时装媒体", domain: "media.example", publisherGroup: "media",
    language: "zh", region: "global", type: "media", tier: 2, paywall: false, crawlable: true,
  };
  return buildReport({
    claims: [claim], evidence, sources: [source], dataset: "测试",
    synthetic: true, inputs: { evidence: "", claims: "", sources: "" }, today: "2026-10-01",
  });
}

test("高置信度需要足量、方向相符、区间不重叠及转载占比不超过 30%", () => {
  const sample = [...items("A", 3, 20), ...items("B", 17, 20)];
  const atLimit = buildFinding(claim, sample, { reprintShare: 0.3 });
  assert.equal(atLimit.comparison.ciOverlap, false);
  assert.equal(atLimit.confidence, "high");
  assert.equal(buildFinding(claim, sample, { reprintShare: 0.3001 }).confidence, "medium");
  assert.equal(buildFinding({ ...claim, direction: "down" }, sample).confidence, "low");
});

test("5 个百分点的效应门槛按原始计数判定", () => {
  const atThreshold = buildFinding(claim, [...items("A", 6, 20), ...items("B", 7, 20)]);
  assert.equal(atThreshold.comparison.deltaPp, 5);
  assert.equal(atThreshold.comparison.ciOverlap, true);
  assert.equal(atThreshold.confidence, "medium");
  const underThreshold = buildFinding(claim, [...items("A", 0, 201), ...items("B", 10, 201)]);
  assert.equal(underThreshold.comparison.deltaPp, 5);
  assert.equal(underThreshold.confidence, "low");
});

test("样本数低于门槛或编码规则缺失时暂缓结论", () => {
  const a = items("A", 0, 20);
  a[0].codings.sheer = "false";
  const sample = [...a, ...items("B", 20, 20)];
  const insufficient = buildFinding(claim, sample);
  assert.equal(insufficient.comparison.a.n, 19);
  assert.equal(insufficient.confidence, "low");
  assert.equal(insufficient.status, "insufficient-sample");
  assert.match(insufficient.statement, /证据不足/);
  assert.deepEqual(insufficient.support, []);
  assert.deepEqual(insufficient.counter, []);
  assert.match(insufficient.caveats.join(" "), /1 条证据未编码/);

  const unfrozen = buildFinding({ ...claim, codingRule: " " }, sample);
  assert.equal(unfrozen.status, "unfrozen-rule");
  assert.match(unfrozen.statement, /规则尚未冻结/);
  assert.deepEqual(unfrozen.support, []);
});

test("上涨和下降使用对应的反证，变化命题使用观测方向", () => {
  const a = items("A", 1, 2);
  const b = items("B", 1, 3);
  const sample = [...a, ...b];
  const up = buildFinding({ ...claim, minN: 2 }, sample, { reprintShare: 0, counterLimit: 2 });
  assert.deepEqual(up.support, ["B0"]);
  assert.deepEqual(up.counter, ["A0", "B1"]);
  assert.match(up.caveats.join(" "), /反证共 3 条/);

  const down = buildFinding({ ...claim, minN: 2, direction: "down" }, sample);
  const change = buildFinding({ ...claim, minN: 2, direction: "change" }, sample);
  assert.deepEqual(down.support, ["B1", "B2"]);
  assert.deepEqual(down.counter, ["B0", "A1"]);
  assert.deepEqual(change.support, down.support);
  assert.deepEqual(change.counter, down.counter);
});

test("报告展示暂缓原因，无样本的一组不显示零占比", () => {
  const report = reportFor(items("B", 3, 3));
  const config = DeckConfigSchema.parse({ seasonLabel: "测试季", seasonCode: "TEST", periodLabel: "测试时段", coverTitle: "示例报告" });
  const model = buildDeck(report, config);
  const markdown = renderMarkdown(model);
  const html = renderDeck(model);
  assert.match(markdown, /证据不足/);
  assert.doesNotMatch(markdown, /\| 出现率 \|/);
  assert.match(html, /证据不足/);
  assert.doesNotMatch(html, /class="fig-num"/);
});

test("只有反证的有效样本可报告命题缺少支撑", () => {
  const report = reportFor([...items("A", 10, 20), ...items("B", 0, 20)]);
  const result = report.findings[0];
  assert.equal(result.status, undefined);
  assert.equal(result.confidence, "low");
  assert.deepEqual(result.support, []);
  assert.ok(result.counter.length > 0);
  assert.equal(report.audit.some((issue) => issue.code === "E_NO_SUPPORT"), false);
});
