import test from "node:test";
import assert from "node:assert/strict";
import { ci, compareProportions, pct, proportion, wilson } from "../src/core/metrics.ts";

test("wilson 在小样本上给出合理区间", () => {
  const w = wilson(3, 15);
  assert.equal(Number(w.share.toFixed(3)), 0.2);
  assert.ok(w.ciLow < 0.2 && w.ciHigh > 0.2);
  assert.ok(w.ciLow >= 0 && w.ciHigh <= 1);
});

test("n=0 时不炸，返回全区间", () => {
  const w = wilson(0, 0);
  assert.equal(w.share, 0);
  assert.equal(w.ciLow, 0);
  assert.equal(w.ciHigh, 1);
});

test("全真与全假落在边界", () => {
  assert.equal(wilson(10, 10).share, 1);
  assert.equal(wilson(0, 10).share, 0);
  assert.ok(wilson(10, 10).ciLow > 0.6);
});

test("proportion 计数正确", () => {
  const p = proportion([true, false, true, true]);
  assert.equal(p.n, 4);
  assert.equal(p.k, 3);
  assert.equal(p.share, 0.75);
});

test("compareProportions 判断区间是否重叠", () => {
  const a = proportion([true, true, true, false, false, false, false, false]);
  const b = proportion([true, true, true, true, true, true, true, false]);
  const cmp = compareProportions(a, b);
  assert.ok(cmp.deltaPp > 0);
  assert.equal(typeof cmp.ciOverlap, "boolean");
});

test("展示函数不丢精度", () => {
  assert.equal(pct(0.2), "20.0%");
  assert.match(ci(wilson(3, 15)), /^\d+\.\d–\d+\.\d%$/);
});
