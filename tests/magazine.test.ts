import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { analyze } from "../src/index.ts";
import { renderMagazine, type TrendBook } from "../src/core/render/magazine.ts";

const opts = {
  evidencePath: "data/evidence.real.json",
  claimsPath: "data/claims.real.json",
  sourcesPath: "data/sources.real.json",
  today: "2026-11-01",
};

const book = JSON.parse(fs.readFileSync("data/trends.json", "utf8")) as TrendBook;

test("趋势内容层：六板块、十二条", () => {
  assert.equal(book.boards.length, 6);
  assert.equal(book.trends.length, 12);
  assert.equal(new Set(book.trends.map((t) => t.board)).size, 6);
});

test("每条趋势都有引用、图片和关键词", () => {
  for (const t of book.trends) {
    assert.ok(t.quotes.length >= 2, `${t.id} 引用不足`);
    assert.ok(t.images.length >= 2, `${t.id} 图片不足`);
    assert.ok(t.keywords.length >= 5, `${t.id} 关键词不足`);
    assert.ok(t.intent.length > 8, `${t.id} 立意缺失`);
    assert.equal(t.form.length, 3, `${t.id} 构型不是三条`);
  }
});

test("图文版渲染：含图片、词云和趋势名", () => {
  const report = analyze(opts);
  const html = renderMagazine(book, report);
  assert.match(html, /轻薄透视/);
  assert.match(html, /assets\/img\//);
  assert.match(html, /class="cloud"/);
  assert.ok(html.length > 20000);
});

test("图片路径按输出目录补前缀，且不重复叠加", () => {
  const report = analyze(opts);
  const root = renderMagazine(book, report);
  assert.match(root, /src="assets\/img\//);

  const nested = renderMagazine(book, report, { assetPrefix: "../../" });
  assert.match(nested, /src="\.\.\/\.\.\/assets\/img\//);
  assert.equal(nested.includes("../../../assets/"), false);
});

test("图文版不出现工程词", () => {
  const report = analyze(opts);
  const html = renderMagazine(book, report);
  for (const bad of ["95% CI", "publisher group", "pp<"]) {
    assert.equal(html.includes(bad), false, `不该出现 ${bad}`);
  }
});
