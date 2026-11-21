import fs from "node:fs";

// 用仓库里已有的真实语料检验术语表覆盖率
const files = [
  "data/trends.source.json",
  "data/claims.real.json",
  "data/corpus/summary.json",
  "data/evidence.sample.json",
];

const chunks = [];
const collect = (v) => {
  if (typeof v === "string") chunks.push(v);
  else if (Array.isArray(v)) v.forEach(collect);
  else if (v && typeof v === "object") Object.values(v).forEach(collect);
};
for (const f of files) {
  try {
    collect(JSON.parse(fs.readFileSync(f, "utf8")));
  } catch {
    console.log("读取失败", f);
  }
}
const text = chunks.join("\n");
console.log("语料字符数:", text.length, "｜片段:", chunks.length);

const terms = JSON.parse(fs.readFileSync("data/corpus/terms.json", "utf8")).terms;
const lower = text.toLowerCase();

const hitZh = terms.filter((t) => text.includes(t.zh));
const hitEn = terms.filter((t) => (t.en || "").length > 3 && lower.includes(t.en.toLowerCase()));

const hitSet = new Set([...hitZh, ...hitEn].map((t) => t.zh));
console.log(`\n命中：${hitSet.size} / ${terms.length}（${Math.round((hitSet.size / terms.length) * 100)}%）`);
console.log("中文命中示例:", hitZh.slice(0, 15).map((t) => t.zh).join("、"));
console.log("英文命中示例:", hitEn.slice(0, 15).map((t) => `${t.zh}(${t.en})`).join("、"));

// 反向：语料里的高频时尚词，表里没有的
const freq = new Map();
for (const m of text.toLowerCase().matchAll(/[a-z][a-z-]{3,}/g)) {
  const w = m[0];
  freq.set(w, (freq.get(w) || 0) + 1);
}
const inTable = new Set(terms.flatMap((t) => (t.en || "").toLowerCase().split(/[\s/]+/)).filter(Boolean));
const missing = [...freq.entries()]
  .filter(([w, n]) => n >= 2 && !inTable.has(w))
  .sort((a, b) => b[1] - a[1])
  .slice(0, 40);
console.log("\n语料里高频、表里没有的词（前 40）:");
console.log(missing.map(([w, n]) => `${w}(${n})`).join(" "));
