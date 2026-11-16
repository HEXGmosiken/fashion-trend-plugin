import test from "node:test";
import assert from "node:assert/strict";
import { analyze, buildDeckModel, render } from "../src/index.ts";
import { deltaText, pctInt, statementLines } from "../src/core/present.ts";

const opts = {
  evidencePath: "data/evidence.sample.json",
  claimsPath: "data/claims.json",
  sourcesPath: "data/sources.json",
  today: "2026-11-01",
};

test("占比取整", () => {
  assert.equal(pctInt(0.5), 50);
  assert.equal(pctInt(0.273), 27);
  assert.equal(pctInt(0), 0);
});

test("变化文案用点，不用 pp", () => {
  assert.deepEqual(deltaText(27, 50), { text: "高出 23 点", dir: "up" });
  assert.deepEqual(deltaText(53, 20), { text: "低 33 点", dir: "down" });
  assert.equal(deltaText(55, 56).dir, "flat");
});

test("结论句里没有括号和工程缩写", () => {
  const lines = statementLines("轻薄透视", 27, 50, 22, 16, 6, 8, "medium");
  const joined = lines.join("");
  for (const bad of ["（", "）", "CI", "pp", "medium", "%（"]) {
    assert.equal(joined.includes(bad), false, `不该出现 ${bad}`);
  }
  assert.match(joined, /高出 23 点/);
});

test("版式模型：每屏一条趋势，标题来自配置", () => {
  const report = analyze(opts);
  const model = buildDeckModel(report);
  assert.equal(model.pages.length, 3);
  assert.equal(model.pages[0]!.title, "轻薄透视");
  assert.equal(model.pages[0]!.no, "01");
  assert.equal(model.pages[0]!.dots, 3);
  assert.ok(model.pages[0]!.support.length > 0);
});

test("deck 里不出现工程词", () => {
  const report = analyze(opts);
  const html = render.deck(report);
  assert.equal(html.includes("95% CI"), false);
  assert.equal(html.includes("publisher group"), false);
  assert.equal(html.includes("pp<"), false);
  assert.match(html, /置信度/);
});
