import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { layoutCloud } from "../src/core/shapecloud.ts";
import { extractTrends, type Article } from "../src/core/auto.ts";
import { articles } from "./fixtures/articles.ts";

const words = [
  { t: "薄纱", n: 20 }, { t: "蕾丝", n: 18 }, { t: "层次", n: 12 },
  { t: "肌理", n: 10 }, { t: "剪裁", n: 8 }, { t: "皮革", n: 6 },
  { t: "针织", n: 5 }, { t: "红色", n: 4 }, { t: "长裙", n: 3 },
];

test("形状词云：词都落在画布内，且互不重叠", () => {
  const out = layoutCloud(words, { width: 440, height: 340, mask: "heart" });
  assert.ok(out.words.length >= 5, "至少放下五个词");
  for (const w of out.words) {
    assert.ok(w.x > 0 && w.x < 440 && w.y > 0 && w.y < 340, `${w.t} 越界`);
  }
  const keys = new Set(out.words.map((w) => `${w.x},${w.y}`));
  assert.equal(keys.size, out.words.length, "不能重叠在同一位置");
});

test("形状词云：最大词的字号明显大于最小词", () => {
  const out = layoutCloud(words, { width: 440, height: 340, mask: "heart" });
  const sizes = out.words.map((w) => w.size);
  assert.ok(Math.max(...sizes) >= Math.min(...sizes) * 1.8);
});

test("自动抽取：六板块的示例文章生成报告", () => {
  const { book, stats } = extractTrends(articles);
  assert.equal(stats.articles, articles.length);
  assert.ok(book.trends.length >= 10, `趋势太少：${book.trends.length}`);
  assert.equal(new Set(book.trends.map((t) => t.board)).size, 6);
});

const realCorpus = "data/articles.real.json";
test("自动抽取：可选的 50 篇项目原始语料", { skip: !fs.existsSync(realCorpus) && "仓库不分发原始语料" }, () => {
  const { articles: original } = JSON.parse(fs.readFileSync(realCorpus, "utf8")) as { articles: Article[] };
  const { book, stats } = extractTrends(original);
  assert.equal(stats.articles, 50);
  assert.ok(book.trends.length >= 10);
  assert.equal(new Set(book.trends.map((t) => t.board)).size, 6);
});

test("自动抽取：每条趋势都有引用和词", () => {
  const { book } = extractTrends(articles);
  for (const t of book.trends) {
    assert.ok(t.quotes.length >= 1, `${t.id} 没有引用`);
    assert.ok(t.keywords.length >= 3, `${t.id} 关键词太少`);
    assert.ok(t.intent.length > 6);
  }
});

test("自动抽取：同输入同输出", () => {
  const a = extractTrends(articles).book.trends.map((t) => t.id + t.name).join();
  const b = extractTrends(articles).book.trends.map((t) => t.id + t.name).join();
  assert.equal(a, b);
});
