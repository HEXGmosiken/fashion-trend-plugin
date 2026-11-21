/** 文本版趋势报告：结构与 deck 一致，只是用 Markdown 表达。 */
import type { DeckModel } from "../present.ts";
import { dotGlyphs } from "../present.ts";
import type { Evidence } from "../schema.ts";

function evRow(e: Evidence, name: string): string {
  return `| ${e.id} | [${e.title.replace(/\|/g, "｜")}](${e.url}) | ${name} | ${e.publishedAt} | ${e.window} |`;
}

export function renderMarkdown(m: DeckModel): string {
  const L: string[] = [];
  const srcName = new Map(m.appendix.sources.map((s) => [s.id, s.name]));

  L.push(`# ${m.coverTitle}`, "");
  L.push(`${m.seasonLabel}　${m.periodLabel}`, "");
  if (m.coverSub) L.push(`> ${m.coverSub}`, "");
  if (m.synthetic) L.push("> 示例数据　仅用于验证流程", "");
  L.push(`样本 ${m.totals.evidence} 篇　来源 ${m.totals.sources} 家　结论 ${m.totals.findings} 条`, "");
  L.push("---", "");

  for (const p of m.pages) {
    L.push(`## ${p.no}　${p.title}`, "");
    if (p.kwA || p.kwB) L.push(`${p.kwA} / ${p.kwB}`, "");
    L.push("");
    for (const line of p.lines) L.push(line, "");
    if (p.status) continue;
    const unit = p.sample?.unitLabel ?? "篇报道";
    L.push(`| | ${(p.sample?.labelA ?? "2026 秋冬").replace(/\|/g, "｜")} | ${(p.sample?.labelB ?? "2027 春夏").replace(/\|/g, "｜")} |`);
    L.push("|---|---|---|");
    L.push(`| 出现率 | ${p.shareA}% | ${p.shareB}% |`);
    L.push(`| 样本 | ${p.kA} / ${p.nA} ${unit} | ${p.kB} / ${p.nB} ${unit} |`);
    L.push("");
    L.push(`${p.delta.text}　置信度 ${dotGlyphs(p.dots).join("")} ${p.confLabel}　支撑证据 ${p.evidenceCount} 条　来源 ${p.sourceCount} 家`, "");
    L.push("<details><summary>证据</summary>", "");
    for (const e of p.support.slice(0, 10)) {
      L.push(`- [${e.title}](${e.url})　${e.source}　${e.date}`);
    }
    L.push("", `局限：${p.caveats.join("　")}`, "", "</details>", "");
    if (p.counter?.length) {
      L.push("<details><summary>反证</summary>", "");
      for (const e of p.counter) L.push(`- [${e.title}](${e.url})　${e.source}　${e.date}`);
      L.push("", "</details>", "");
    }
  }

  L.push("---", "", "## 附录", "");
  L.push("### 口径", "");
  for (const c of m.appendix.claims) {
    L.push(`- ${c.id}　${c.question}`);
    L.push(`  窗口　${c.windowA.label} 对 ${c.windowB.label}`);
    L.push(`  编码　${c.codingRule}`);
  }
  L.push("");
  L.push(`### 证据台账　共 ${m.appendix.evidence.length} 篇`, "");
  L.push("| 编号 | 标题 | 来源 | 发布 | 窗口 |");
  L.push("|---|---|---|---|---|");
  for (const e of m.appendix.evidence) {
    L.push(evRow(e, srcName.get(e.sourceId) ?? e.sourceId));
  }
  L.push("");
  L.push("### 质量检查", "");
  L.push(`${m.audit.errors} 个错误　${m.audit.warnings} 个警告　去重剔除 ${m.totals.duplicates} 条`, "");
  if (m.appendix.notes) L.push(`数据说明：${m.appendix.notes}`, "");

  return L.join("\n");
}
