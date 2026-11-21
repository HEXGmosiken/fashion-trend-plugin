/**
 * 趋势报告的 Markdown 版：和 deck.html 同源，但可以贴进文档、邮件和 PPT。
 * 图片用相对路径引用，和 deck.html 放在同一目录即可正常显示。
 */
import type { TrendBook } from "./magazine.ts";
import type { SummaryModel } from "../summary.ts";

function assetSrc(path: string, prefix: string): string {
  if (/^(https?:|data:)/.test(path)) return path;
  return prefix + path.replace(/^(\.\.\/)+/, "");
}

function boardName(book: TrendBook, key: string): string {
  return book.boards.find((b) => b.key === key)?.name ?? key;
}

export function renderTrendMarkdown(
  book: TrendBook,
  opts: { assetPrefix?: string; summary?: SummaryModel } = {},
): string {
  const prefix = opts.assetPrefix ?? "";
  const L: string[] = [];

  L.push(`# ${book.seasonLabel}女装趋势`, "");
  if (book.seasonCode) L.push(`> ${book.seasonCode}　${book.periodLabel}`, "");
  else L.push(`> ${book.periodLabel}`, "");
  L.push(book.intro, "");
  L.push(
    `共 ${book.trends.length} 条趋势，覆盖 ${book.boards.length} 个板块。每条都附原文出处，可按链接复核。`,
    "",
  );

  // 总述
  if (opts.summary) {
    const s = opts.summary;
    L.push("## 总述", "");
    L.push(`**${s.thesis}**`, "");
    s.blocks.forEach((b, i) => {
      L.push(`### ${["一", "二", "三", "四", "五"][i] ?? i + 1}、${b.title}`, "");
      L.push(b.claim, "");
      if (b.data) L.push(`> 数据：${b.data}`, "");
      if (b.missing.length) L.push(`> ${b.missing.map((name) => `「${name}」`).join("、")}缺少统计数据。`, "");
    });
    L.push("### 反证", "");
    L.push(s.counter.claim, "");
    if (s.counter.data) L.push(`> 数据：${s.counter.data}`, "");
    if (s.counter.missing.length) L.push(`> ${s.counter.missing.map((name) => `「${name}」`).join("、")}缺少统计数据。`, "");
    L.push("", s.close, "");
    L.push("---", "");
  }

  // 目录
  L.push("## 目录", "");
  for (const b of book.boards) {
    const items = book.trends.filter((t) => t.board === b.key);
    if (!items.length) continue;
    L.push(`**${b.name}**　${b.desc}`);
    for (const t of items) L.push(`- ${t.name}　${t.code}`);
    L.push("");
  }
  L.push("---", "");

  // 正文
  book.trends.forEach((t, i) => {
    const no = String(i + 1).padStart(2, "0");
    L.push(`## ${no}　${t.name}`, "");
    L.push(`${t.code}　|　${boardName(book, t.board)}　|　${t.tags.join(" · ")}`, "");
    if (t.reading) L.push(`**读法**：${t.reading}`, "");
    L.push(`**趋势判断**：${t.intent}`, "");
    if (t.evidenceLine) L.push(`> 数据：${t.evidenceLine}`, "");

    if (t.form.length) {
      L.push("**要点**", "");
      for (const f of t.form) L.push(`- ${f}`);
      L.push("");
    }

    if (t.expression) L.push(`**怎么穿**：${t.expression}`, "");

    if (t.keywords.length) {
      L.push(`**语料高频词**：${t.keywords.slice(0, 10).map((k) => k.t).join("、")}`, "");
    }

    if (t.claim) {
      const c = t.claim;
      const d = c.deltaPp ?? c.shareB - c.shareA;
      const sign = d > 0 ? `高出 ${d} 点` : d < 0 ? `低 ${Math.abs(d)} 点` : "基本持平";
      const unit = c.unitLabel ?? "篇";
      L.push("**数据**", "");
      L.push(`| 时间窗 | 占比 | 样本 |`);
      L.push(`|---|---|---|`);
      L.push(`| ${(c.labelA ?? "2026 秋冬").replace(/\|/g, "\\|")} | ${c.shareA}% | ${c.nA} ${unit}中 ${c.kA} ${unit} |`);
      L.push(`| ${(c.labelB ?? "2027 春夏").replace(/\|/g, "\\|")} | ${c.shareB}% | ${c.nB} ${unit}中 ${c.kB} ${unit} |`);
      L.push("");
      L.push(`变化：${sign}，置信度${c.confidence === "high" ? "高" : c.confidence === "medium" ? "中" : "低"}。`, "");
    }

    if (t.quotes.length) {
      L.push("**原文出处**", "");
      for (const q of t.quotes) {
        L.push(`> ${q.text.replace(/\n+/g, " ")}`);
        L.push(`> —— ${q.source}，${q.date}，[原文链接](${q.url})`);
        L.push("");
      }
    }

    const imgs = t.images.slice(0, 3);
    if (imgs.length) {
      L.push("**参考图**", "");
      for (const im of imgs) L.push(`![${t.name}](${assetSrc(im.src, prefix)})`);
      L.push("");
    }

    L.push("---", "");
  });

  // 附录
  L.push("## 附录：口径说明", "");
  L.push(`- 数据来源：${book.periodLabel}的文章样本。`);
  L.push("- 趋势名与板块归属由词表命中与人工校正确定，不是模型自由生成。");
  L.push("- 原文引用为自动摘句，点链接可回原文核对；引用只代表该作者的判断。");
  L.push("- 数据一条只覆盖被编码的样本，不外推到整个市场。");
  L.push("");

  return L.join("\n");
}
