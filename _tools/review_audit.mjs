import fs from "node:fs";

const terms = JSON.parse(fs.readFileSync("data/corpus/terms.json", "utf8")).terms;
const patterns = JSON.parse(fs.readFileSync("data/corpus/patterns.json", "utf8")).patterns;
const zhSet = new Set(terms.map((t) => t.zh));
const issues = [];
const flag = (type, target, detail) => issues.push({ type, target, detail });

// 1) 易混词指向的词条是否存在
for (const t of terms) {
  const m = (t.confusable || "").match(/^([^：:]{1,12})[：:]/);
  if (!m) {
    flag("易混词格式", t.zh, "没有「词条：区别」结构");
    continue;
  }
  const ref = m[1].trim();
  const containsTerm = [...zhSet].some((z) => z.length >= 2 && ref.includes(z));
  if (!zhSet.has(ref) && !containsTerm && !/同一|同类|泛指|统称/.test(ref)) {
    flag("易混词悬空", t.zh, `指向「${ref}」，表里没有这个词`);
  }
}

// 2) id 与英文名是否一致
const slug = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
for (const t of terms) {
  const expect = slug(t.en);
  if (t.id !== expect && !t.id.startsWith(expect)) {
    flag("id 与英文名不符", t.zh, `id=${t.id}，英文名 slug=${expect}`);
  }
}

// 3) 别名是否被别的词条占用
const owner = new Map();
for (const t of terms) {
  for (const a of t.aliases || []) {
    const holder = owner.get(a);
    if (holder && holder !== t.zh) flag("别名冲突", `${t.zh}/${holder}`, `都用别名「${a}」`);
    owner.set(a, t.zh);
  }
}

// 4) 判据里是否提到不存在的词
for (const t of terms) {
  for (const other of termRefs(t)) {
    if (!zhSet.has(other)) flag("判据引用悬空", t.zh, `判据提到「${other}」，表里没有`);
  }
}

function termRefs(t) {
  const out = [];
  const text = `${t.criterion}${t.confusable}`;
  for (const x of terms) {
    if (x.zh !== t.zh && x.zh.length >= 2 && text.includes(x.zh)) out.push(x.zh);
  }
  return out;
}

// 5) 句式变体的占位符必须与模板一致
for (const p of patterns) {
  const slots = new Set([...p.template.matchAll(/\{([A-Za-z]+)\}/g)].map((m) => m[1]));
  for (const v of p.variants || []) {
    const used = new Set([...v.matchAll(/\{([A-Za-z]+)\}/g)].map((m) => m[1]));
    for (const u of used) {
      if (!slots.has(u)) flag("句式占位符不符", p.id, `变体用了 {${u}}，模板只有 {${[...slots].join(",")}}`);
    }
    if (used.size === 0) flag("句式占位符缺失", p.id, `变体没有占位符：${v}`);
  }
  // 变体里出现模板外的字母占位符
}

// 6) parent 是否是受控词表
const parents = new Map();
for (const t of terms) parents.set(t.parent, (parents.get(t.parent) || 0) + 1);
const singletons = [...parents.entries()].filter(([, n]) => n === 1).map(([k]) => k);
if (singletons.length) flag("parent 过于零散", "全表", `${singletons.length} 个 parent 只出现一次：${singletons.join("、")}`);

console.log(`问题总数 ${issues.length}`);
const byType = {};
for (const i of issues) byType[i.type] = (byType[i.type] || 0) + 1;
console.log(byType);
for (const i of issues) console.log(`[${i.type}] ${i.target} — ${i.detail}`);
