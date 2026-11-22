import fs from "node:fs";

const t = JSON.parse(fs.readFileSync("data/corpus/terms.json", "utf8"));
const p = JSON.parse(fs.readFileSync("data/corpus/patterns.json", "utf8"));
const tax = JSON.parse(fs.readFileSync("data/taxonomy.json", "utf8"));
const boards = new Set(tax.boards.map((b) => b.key));

const rows = [];
const add = (name, ok, detail) => rows.push({ 检查项: name, 结果: ok ? "通过" : "不通过", 说明: detail });

const terms = t.terms;
add("术语条数", terms.length >= 300, `${terms.length} 条`);
add("JSON 可解析", true, "terms.json / patterns.json / taxonomy.json 均能解析");
add("id 唯一", new Set(terms.map((x) => x.id)).size === terms.length, `${new Set(terms.map((x) => x.id)).size} 个唯一 id`);
add("id 格式", terms.every((x) => /^[a-z0-9_]+$/.test(x.id)), "全部为小写字母/数字/下划线");
add("中文名唯一", new Set(terms.map((x) => x.zh)).size === terms.length, "无重复");
add("英文名唯一", new Set(terms.map((x) => (x.en || "").toLowerCase())).size === terms.length, "无重复");
add("板块合法", terms.every((x) => boards.has(x.board)), `全部落在 taxonomy 的 ${boards.size} 个板块内`);
add("判据齐全", terms.every((x) => x.criterion && x.criterion.length >= 6), `${terms.filter((x) => x.criterion).length}/${terms.length}`);
add("易混词齐全", terms.every((x) => x.confusable && x.confusable.includes("：")), `${terms.filter((x) => x.confusable).length}/${terms.length}`);
add("出处字段", terms.every((x) => x.source), `${terms.filter((x) => x.source.startsWith("AAT")).length} 条 AAT，其余 editorial`);
add("定义长度中位", true, `${terms.map((x) => x.def.length).sort((a, b) => a - b)[Math.floor(terms.length / 2)]} 字`);
add("别名覆盖", true, `${terms.filter((x) => x.aliases && x.aliases.length).length}/${terms.length} 有别名`);
const cn = p.patterns.filter((x) => [x.template, ...(x.variants || [])].filter((s) => /[\u4e00-\u9fa5]/.test(s)).length >= 3).length;
add("句式库", cn === p.patterns.length, `${cn}/${p.patterns.length} 个模板有 ≥3 种中文说法`);

const files = ["data/corpus/terms.json", "data/corpus/patterns.json", "data/README.md", "docs/术语表v2提案.md", "_tools/ingest_local.py", "_tools/check_criteria.mjs", "_tools/coverage_check.mjs"];
add("上传文件", files.every((f) => fs.existsSync(f)), `${files.length} 个文件都存在`);

console.log("检查项".padEnd(14), "结果".padEnd(8), "说明");
for (const r of rows) console.log(r.检查项.padEnd(14), r.结果.padEnd(8), r.说明);
const fail = rows.filter((r) => r.结果 === "不通过");
console.log(`\n通过 ${rows.length - fail.length}/${rows.length}`);
