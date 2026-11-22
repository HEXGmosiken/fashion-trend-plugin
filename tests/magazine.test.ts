import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { extractTrends } from "../src/core/auto.ts";
import { renderMagazine, type TrendBook } from "../src/core/render/magazine.ts";
import { articles } from "./fixtures/articles.ts";

const { book, report } = extractTrends(articles);
const editorial = JSON.parse(fs.readFileSync("data/trends.source.json", "utf8")) as Pick<TrendBook, "trends">;

test("趋势内容层：编辑稿覆盖六板块、十二条", () => {
  assert.equal(book.boards.length, 6);
  assert.equal(editorial.trends.length, 12);
  assert.equal(new Set(editorial.trends.map((t) => t.board)).size, 6);
  assert.ok(editorial.trends.every((t) => t.form.length === 3));
});

const generatedBook = "data/trends.json";
test("可选的真实趋势数据含引用、图片和关键词", { skip: !fs.existsSync(generatedBook) && "仓库不分发真实生成物" }, () => {
  const generated = JSON.parse(fs.readFileSync(generatedBook, "utf8")) as TrendBook;
  for (const t of generated.trends) {
    assert.ok(t.quotes.length >= 2, `${t.id} 引用不足`);
    assert.ok(t.images.length >= 2, `${t.id} 图片不足`);
    assert.ok(t.keywords.length >= 5, `${t.id} 关键词不足`);
    assert.ok(t.intent.length > 8, `${t.id} 立意缺失`);
    assert.equal(t.form.length, 3, `${t.id} 构型不是三条`);
  }
});

test("图文版渲染：含图片和趋势名，不含词云", () => {
  const html = renderMagazine(book, report);
  assert.match(html, /薄纱/);
  assert.match(html, /assets\/img\//);
  assert.doesNotMatch(html, /class="cloud"/);
  assert.ok(html.length > 20000);
});

test("图片路径按输出目录补前缀，且不重复叠加", () => {
  const root = renderMagazine(book, report);
  assert.match(root, /src="assets\/img\//);

  const nested = renderMagazine(book, report, { assetPrefix: "../../" });
  assert.match(nested, /src="\.\.\/\.\.\/assets\/img\//);
  assert.equal(nested.includes("../../../assets/"), false);
});

test("图文版不出现工程词", () => {
  const html = renderMagazine(book, report);
  for (const bad of ["95% CI", "publisher group", "pp<"]) {
    assert.equal(html.includes(bad), false, `不该出现 ${bad}`);
  }
});
