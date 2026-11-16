/** 语料库读取：术语表 → 匹配用词条；句式库 → 模板。 */
import fs from "node:fs";

export interface TermRecord {
  zh: string;
  en: string;
  aliases: string[];
  def: string;
  board: string;
}

export interface PatternRecord {
  id: string;
  type: string;
  template: string;
  slots: Record<string, string>;
  examples: string[];
  when: string;
}

export interface Corpus {
  terms: TermRecord[];
  patterns: PatternRecord[];
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 中文直接匹配；英文加词边界，避免 cut 命中 cut-out 之外的词根。返回正则不带 g，便于 .test() */
export function termRegex(term: TermRecord): RegExp {
  const zh = [term.zh, ...term.aliases.filter((a) => /[\u4e00-\u9fff]/.test(a))].map(escRe);
  const en = [term.en, ...term.aliases.filter((a) => /^[\x20-\x7e]+$/.test(a))].map(escRe);
  const parts: string[] = [];
  if (zh.length) parts.push(zh.join("|"));
  if (en.length) parts.push(`\\b(?:${en.join("|")})\\b`);
  return new RegExp(parts.join("|"), "i");
}

/** 统计出现次数：用带 g 的副本，避免污染 test() 的 lastIndex */
export function countMatches(text: string, re: RegExp): number {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  return (text.match(g) ?? []).length;
}

export function loadCorpus(dir = "data/corpus"): Corpus {
  const read = (p: string) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null);
  const t = read(`${dir}/terms.json`);
  const p = read(`${dir}/patterns.json`);
  return {
    terms: (t?.terms ?? []) as TermRecord[],
    patterns: (p?.patterns ?? []) as PatternRecord[],
  };
}

/** 用模板和槽位生成一句话，给报告做「人话」版本 */
export function fillPattern(pattern: PatternRecord, slots: Record<string, string>): string {
  return pattern.template.replace(/\{(\w+)\}/g, (_, k) => slots[k] ?? "…");
}
