import fs from "node:fs";

const file = process.argv[2] || "data/corpus/terms.json";
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const terms = data.terms;
console.log("检查文件:", file);
console.log("条数:", terms.length);

const byBoard = {};
for (const t of terms) byBoard[t.board] = (byBoard[t.board] || 0) + 1;
console.log("板块分布：", byBoard);

const dupOf = (arr) => [...new Set(arr.filter((x, i) => x && arr.indexOf(x) !== i))];
const zh = terms.map((t) => t.zh);
const en = terms.map((t) => (t.en || "").toLowerCase()).filter(Boolean);
console.log("重复中文名：", dupOf(zh).length ? dupOf(zh) : "无");
console.log("重复英文名：", dupOf(en).length ? dupOf(en) : "无");

const noEn = terms.filter((t) => !t.en || !t.en.trim());
const noAlias = terms.filter((t) => !Array.isArray(t.aliases) || t.aliases.length === 0);
const shortDef = terms.filter((t) => !t.def || t.def.trim().length < 6);
const hasCriterion = terms.filter((t) => t.criterion);
console.log("缺英文名：", noEn.length);
console.log("无别名：", noAlias.length);
console.log("定义过短(<6字)：", shortDef.length);
console.log("有判据：", hasCriterion.length);

const lens = terms.map((t) => (t.def || "").length).sort((a, b) => a - b);
console.log("定义长度：min", lens[0], "中位", lens[Math.floor(lens.length / 2)], "max", lens[lens.length - 1]);
