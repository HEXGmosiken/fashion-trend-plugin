import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadCorpus, termRegex, countMatches } from "../src/core/corpus.ts";
import { extractTrends, termsFromCorpus, type Article } from "../src/core/auto.ts";
import { buildSummary, type RawSummary } from "../src/core/summary.ts";
import { renderTrendMarkdown } from "../src/core/render/trend-md.ts";
import { renderMagazine } from "../src/core/render/magazine.ts";

const corpus = loadCorpus("data/corpus");
const raw = JSON.parse(fs.readFileSync("data/corpus/summary.json", "utf8")) as RawSummary;
const realArticlesPath = "data/articles.real.json";
const articles: Article[] = [
  "刺绣、蕾丝和珠绣构成表面装饰。静奢、极简与黑色适合日常、职场和晚宴。皮革用于长裙。",
  "长裙使用皮革，辅以刺绣、珠绣和蕾丝。黑色延续静奢与极简，横跨职场、晚宴和日常。",
  "本篇只用于检验样本分母，内容完全为测试而编写。",
].map((text, i) => ({
  id: `fixture-${i}`,
  title: `合成语料 ${i}`,
  url: `https://fixture.example/${i}`,
  date: "2026-10-01",
  source: `合成来源 ${i}`,
  text,
}));
const { book, report } = extractTrends(articles, { terms: termsFromCorpus(corpus.terms), perBoard: 10 });

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
  const names = book.trends.map((t) => t.name);
  assert.ok(names.length >= 10, `趋势太少：${names.length}`);
  for (const n of names) {
    assert.ok(corpus.terms.some((t) => t.zh === n), `${n} 不在术语表里`);
  }
  assert.ok(names.includes("刺绣"), "装饰类术语应进入结果");
});

test("每条趋势都有读法句和数据句", () => {
  for (const t of book.trends) {
    assert.ok(t.reading && t.reading.includes(t.name), `${t.name} 缺读法句`);
    assert.match(t.evidenceLine ?? "", /篇/, `${t.name} 缺数据句`);
  }
});

test("总述：每个论点都能挂到趋势和数据", () => {
  const s = buildSummary(book, raw);
  assert.equal(s.thesis, raw.thesis);
  assert.equal(s.blocks.length, 3);
  for (const b of s.blocks) {
    assert.match(b.data, /篇/, `${b.title} 没有数据行`);
    assert.deepEqual(b.missing, [], `${b.title} 有找不到的趋势`);
  }
  assert.match(s.blocks[0].data, /刺绣 2 篇 67%/);
  assert.match(s.counter.data, /皮革 2 篇 67%/);
});

test("总述保留人工文案，呈现数据缺失和零值", () => {
  const editorial = { ...raw, counter: { claim: "人工填写的反证。", refs: [" 刺绣 ", "刺绣", "皮革", "未知趋势"] } };
  const incomplete = {
    ...book,
    trends: book.trends.map((t) => {
      if (t.name === "刺绣") return { ...t, docs: 0, share: 0 };
      if (t.name === "皮革") return { ...t, share: undefined };
      return t;
    }),
  };
  const summary = buildSummary(incomplete, editorial);
  assert.equal(summary.counter.claim, editorial.counter.claim);
  assert.equal(summary.counter.data, "刺绣 0 篇 0% · 皮革 2 篇");
  assert.deepEqual(summary.counter.missing, ["未知趋势"]);
  for (const rendered of [renderMagazine(incomplete, report, { summary }), renderTrendMarkdown(incomplete, { summary })]) {
    assert.doesNotMatch(rendered, /人工填写的反证/, "反证不应出现在界面上");
    assert.match(rendered, /刺绣 0 篇 0%/);
    assert.doesNotMatch(rendered, /\?%/);
  }
});

test("真实语料总述：人工论点匹配本地文章中的趋势", {
  skip: !fs.existsSync(realArticlesPath) && "需要本地 data/articles.real.json",
}, () => {
  const real: Article[] = JSON.parse(fs.readFileSync(realArticlesPath, "utf8")).articles;
  const { book: realBook } = extractTrends(real, { terms: termsFromCorpus(corpus.terms) });
  assert.ok(realBook.trends.length >= 15);
  const summary = buildSummary(realBook, raw);
  for (const block of [...summary.blocks, summary.counter]) {
    assert.match(block.data, /篇/);
    assert.deepEqual(block.missing, [], block.title);
  }
});
