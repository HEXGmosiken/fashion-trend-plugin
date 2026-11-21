import test from "node:test";
import assert from "node:assert/strict";
import { analyze, render } from "../src/index.ts";
import { loadEvidenceFile } from "../src/core/io.ts";
import { buildReport } from "../src/core/report.ts";

const opts = {
  evidencePath: "data/evidence.sample.json",
  claimsPath: "data/claims.json",
  sourcesPath: "data/sources.json",
  today: "2026-11-01",
};

test("示例数据能跑通完整链路", () => {
  const report = analyze(opts);
  assert.equal(report.findings.length, 3);
  assert.equal(report.evidence.length, 30);
  assert.equal(report.duplicates.length, 1);
  assert.equal(report.meta.synthetic, true);
});

test("C1 判定为高置信度，且方向为正", () => {
  const report = analyze(opts);
  const c1 = report.findings.find((f) => f.claimId === "C1")!;
  assert.equal(c1.confidence, "high");
  assert.ok(c1.comparison.deltaPp > 0);
  assert.equal(c1.comparison.ciOverlap, false);
});

test("C2 判定为下降", () => {
  const report = analyze(opts);
  const c2 = report.findings.find((f) => f.claimId === "C2")!;
  assert.ok(c2.comparison.deltaPp < 0);
});

test("同源折价按命题计算，仍计入去重前适用的重复证据", () => {
  const baseline = analyze(opts);
  const data = loadEvidenceFile(opts.evidencePath);
  const original = data.evidence.find((e) => e.window === "B" && !e.isSponsored)!;
  const duplicates = Array.from({ length: 20 }, (_, i) => ({
    ...original,
    id: `COPY-${i}`,
    url: `${original.url}#copy-${i}`,
    codings: { sheer: original.codings.sheer },
  }));
  const report = buildReport({
    ...data,
    evidence: [...data.evidence, ...duplicates],
    claims: baseline.claims,
    sources: baseline.sources,
    inputs: baseline.meta.inputs,
    today: opts.today,
  });

  assert.equal(report.findings[0].confidence, "medium");
  assert.deepEqual(report.findings[0].comparison, baseline.findings[0].comparison);
  assert.deepEqual(report.findings[1], baseline.findings[1]);
});

test("审计没有错误级问题", () => {
  const report = analyze(opts);
  const errors = report.audit.filter((a) => a.level === "error");
  assert.deepEqual(errors, []);
});

test("渲染层不崩，且示例数据有提示", () => {
  const report = analyze(opts);
  assert.match(render.markdown(report), /示例数据/);
  assert.match(render.deck(report), /示例数据/);
  assert.ok(render.evidenceCsv(report).split("\n").length > 30);
  assert.ok(render.findingsCsv(report).includes("deltaPp"));
  assert.equal(JSON.parse(render.json(report)).findings.length, 3);
});
