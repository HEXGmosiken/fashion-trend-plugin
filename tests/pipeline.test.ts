import test from "node:test";
import assert from "node:assert/strict";
import { analyze, render } from "../src/index.ts";

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
