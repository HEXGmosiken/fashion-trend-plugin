import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("data/corpus/terms.json", "utf8"));
const vague = ["高级", "设计感", "氛围", "感觉", "气质", "品味"];
const rows = [];

for (const t of data.terms) {
  const c = (t.criterion || "").trim();
  const f = (t.confusable || "").trim();
  const reasons = [];
  const isColor = t.board === "color";

  // 颜色类采用"色相＋明度＋饱和度＋与邻色比较"的约定写法，长度门槛更低
  const minLen = isColor ? 8 : 12;
  if (c.length < minLen) reasons.push("判据过短");
  if (vague.some((v) => c.includes(v))) reasons.push("含空泛词");
  // 只有"以词条名开头"才算循环定义
  if (c.startsWith(t.zh)) reasons.push("判据以词条名开头");
  if (!f.includes("：") && !f.includes(":")) reasons.push("易混词无对比");
  if (f.length < 8) reasons.push("易混词过短");

  if (reasons.length) rows.push({ zh: t.zh, board: t.board, c, f, reasons });
}

console.log("总数", data.terms.length, "｜有问题", rows.length);
const byBoard = {};
for (const r of rows) byBoard[r.board] = (byBoard[r.board] || 0) + 1;
console.log("分布", byBoard);
for (const r of rows) console.log(`[${r.board}] ${r.zh} ｜ ${r.reasons.join("、")} ｜ ${r.c}`);
