import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadCorpus, termRegex, countMatches } from "../src/core/corpus.ts";
import { extractTrends, termsFromCorpus, type Article } from "../src/core/auto.ts";
import { buildSummary, type RawSummary } from "../src/core/summary.ts";

const corpus = loadCorpus("data/corpus");
const articles: Article[] = JSON.parse(fs.readFileSync("data/articles.real.json", "utf8")).articles;

test("术语表：覆盖六个板块，字段齐全", () => {
  assert.ok(corpus.terms.length >= 180, `术语太少：${corpus.terms.length}`);
  const boards = new Set(corpus.terms.map((t) => t.board));
  assert.equal(boards.size, 6);
  for (const t of corpus.terms) {
    assert.ok(t.zh && t.en && t.def, `${t.zh} 字段不全`);
    assert.ok(["silhouette", "construction", "material", "color", "aesthetic", "occasion"].includes(t.board));
  }
  const names = corpus.terms.map((t) => t.zh);
  assert.equal(new Set(names).size, names.length, "术语有重名");
});

test("术语表：别名能合并到同一条", () => {
  const tweed = corpus.terms.find((t) => t.zh === "粗花呢")!;
  assert.equal(tweed.en, "tweed");
  assert.ok(tweed.aliases.includes("bouclé"));
  assert.equal(tweed.board, "material");
  assert.ok(termRegex(tweed).test("this season's tweed"));
  assert.ok(termRegex(tweed).test("粗花呢外套"));
});

test("匹配计数不受全局正则状态影响", () => {
  const re = /sheer/gi;
  const n = countMatches("sheer, sheer and sheer", re);
  assert.equal(n, 3);
  assert.equal(re.lastIndex, 0);
});

test("句式库：至少二十条，模板带槽位", () => {
  assert.ok(corpus.patterns.length >= 20, `句式太少：${corpus.patterns.length}`);
  for (const p of corpus.patterns) {
    assert.ok(p.template.includes("{"), `${p.id} 没有槽位`);
    assert.ok(p.examples.length >= 1, `${p.id} 没有例句`);
  }
  const types = new Set(corpus.patterns.map((p) => p.type));
  for (const t of ["shift", "structure", "pairing", "color"]) assert.ok(types.has(t), `缺类型 ${t}`);
});

test("用术语库重跑：趋势名是标准术语", () => {
  const { book } = extractTrends(articles, { terms: termsFromCorpus(corpus.terms) });
  const names = book.trends.map((t) => t.name);
  assert.ok(names.length >= 15, `趋势太少：${names.length}`);
  for (const n of names) {
    assert.ok(corpus.terms.some((t) => t.zh === n), `${n} 不在术语表里`);
  }
  assert.ok(names.includes("刺绣"), "装饰类术语应进入结果");
});

test("每条趋势都有读法句和数据句", () => {
  const { book } = extractTrends(articles, { terms: termsFromCorpus(corpus.terms) });
  for (const t of book.trends) {
    assert.ok(t.reading && t.reading.includes(t.name), `${t.name} 缺读法句`);
    assert.match(t.evidenceLine ?? "", /篇/, `${t.name} 缺数据句`);
  }
});

test("总述：每个论点都能挂到趋势和数据", () => {
  const raw = JSON.parse(fs.readFileSync("data/corpus/summary.json", "utf8")) as RawSummary;
  const { book } = extractTrends(articles, { terms: termsFromCorpus(corpus.terms) });
  const s = buildSummary(book, raw);
  assert.ok(s.thesis.length > 20);
  assert.equal(s.blocks.length, 3);
  for (const b of s.blocks) {
    assert.match(b.data, /篇/, `${b.title} 没有数据行`);
    assert.deepEqual(b.missing, [], `${b.title} 有找不到的趋势`);
  }
  assert.match(s.counter.data, /篇/);
});
