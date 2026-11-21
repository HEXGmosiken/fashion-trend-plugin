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
  for (const n of [1, 10, 15, 100]) {
    const none = wilson(0, n);
    const all = wilson(n, n);
    assert.equal(none.share, 0);
    assert.equal(none.ciLow, 0);
    assert.equal(all.share, 1);
    assert.equal(all.ciHigh, 1);
    assert.ok(Math.abs(none.ciHigh - (1 - all.ciLow)) < 1e-12);
  }
});

test("Wilson 拒绝无效计数，已知区间可复算", () => {
  for (const [k, n] of [[1, 0], [-1, 10], [0, -1], [0.5, 10], [0, Infinity]]) {
    assert.throws(() => wilson(k, n), RangeError);
  }
  const { ciLow, ciHigh } = wilson(5, 10);
  assert.ok(Math.abs(ciLow - 0.23659) < 0.00001);
  assert.ok(Math.abs(ciHigh - 0.76341) < 0.00001);
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

test("区间端点相接算重叠，百分点与相对变化方向按 B 减 A", () => {
  const a = { n: 10, k: 7, share: 0.7, ciLow: 0.5, ciHigh: 1 };
  const b = { n: 10, k: 2, share: 0.2, ciLow: 0, ciHigh: 0.5 };
  const cmp = compareProportions(a, b);
  assert.equal(cmp.deltaPp, -50);
  assert.equal(cmp.relative, -0.714);
  assert.equal(cmp.ciOverlap, true);
  assert.equal(compareProportions(a, { ...b, ciHigh: 0.499 }).ciOverlap, false);
  assert.equal(compareProportions(proportion([false]), b).relative, null);
});

test("展示函数不丢精度", () => {
  assert.equal(pct(0.2), "20.0%");
  assert.match(ci(wilson(3, 15)), /^\d+\.\d–\d+\.\d%$/);
});
