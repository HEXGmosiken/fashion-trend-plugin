#!/usr/bin/env node
/**
 * 命令行入口。
 *   demo     用示例数据跑完整流程
 *   ingest   投喂文章，自动抽取趋势
 *   analyze  精细模式：人工编码 + 双时间窗对比
 *   audit    只跑质量检查
 *   validate 只校验输入
 *
 * 所有输出统一落在 reports/ 下，并自动维护 reports/index.html 目录页。
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { analyze, buildDeckModel } from "../index.ts";
import { loadClaims, loadEvidenceFile, loadSources } from "../core/io.ts";
import { buildReport } from "../core/report.ts";
import { formatIssues, summarize } from "../core/audit.ts";
import { UNIT_LABEL } from "../core/findings.ts";
import { renderMarkdown } from "../core/render/markdown.ts";
import { renderDeck } from "../core/render/deck.ts";
import { renderMagazine, type TrendBook } from "../core/render/magazine.ts";
import { renderTrendMarkdown } from "../core/render/trend-md.ts";
import { renderSite } from "../core/render/site.ts";
import { renderEvidenceCsv, renderFindingsCsv } from "../core/render/csv.ts";
import { renderJson } from "../core/render/json.ts";
import { extractTrends, termsFromCorpus, type Article } from "../core/auto.ts";
import { loadCorpus } from "../core/corpus.ts";
import { buildSummary, type RawSummary } from "../core/summary.ts";
import type { SiteData, SiteEntry } from "../core/types.ts";

const OUT_ROOT = "reports";

const DEFAULTS = {
  evidence: "data/evidence.sample.json",
  claims: "data/claims.json",
  sources: "data/sources.json",
  deck: "data/deck.config.json",
  trends: "data/trends.json",
  articles: "data/articles.real.json",
  corpus: "data/corpus",
};

const HELP = `
trend-lab — 服装趋势分析插件

用法：
  node src/cli/index.ts <command> [options]

命令：
  demo       用示例数据跑完整流程，输出 reports/demo/
  ingest     投喂文章，自动抽取趋势，输出 reports/auto/
  analyze    精细模式，输出 reports/curated/
  validate   只校验输入 JSON
  audit      只跑质量检查（有错误级问题时退出码为 1）

参数：
  --articles <path> 文章文件（默认 ${DEFAULTS.articles}）
  --input <path>    证据文件（默认 ${DEFAULTS.evidence}）
  --claims <path>   命题文件（默认 ${DEFAULTS.claims}）
  --sources <path>  来源注册表（默认 ${DEFAULTS.sources}）
  --trends <path>   趋势内容（默认 ${DEFAULTS.trends}）
  --deck <path>     版式配置（默认 ${DEFAULTS.deck}）
  --out <dir>       自定义输出目录（默认 reports/<mode>）
  --title <text>    报告标题
  -h, --help        显示本帮助

示例：
  pnpm ingest
  pnpm real
  pnpm demo
`;

function log(msg = "") {
  process.stdout.write(msg + "\n");
}

/** 写入 reports/index.html 与 reports/site.json */
function updateSite(entry: SiteEntry): void {
  const idx = path.join(OUT_ROOT, "site.json");
  const data: SiteData = fs.existsSync(idx)
    ? (JSON.parse(fs.readFileSync(idx, "utf8")) as SiteData)
    : { title: "趋势报告入口", entries: [] };
  data.entries = data.entries.filter((e) => e.dir !== entry.dir);
  data.entries.push(entry);
  fs.mkdirSync(OUT_ROOT, { recursive: true });
  fs.writeFileSync(idx, JSON.stringify(data, null, 1), "utf8");
  fs.writeFileSync(path.join(OUT_ROOT, "index.html"), renderSite(data), "utf8");
}

function relDir(outDir: string): string {
  const rel = path.relative(OUT_ROOT, path.resolve(outDir)).split(path.sep).join("/");
  return rel === "" ? "." : rel;
}

/** 从输出目录回到仓库根的相对前缀，例如 reports/curated → ../../ */
function assetPrefixFor(outDir: string): string {
  const rel = path.relative(path.resolve(outDir), process.cwd()).split(path.sep).join("/");
  return rel ? rel + "/" : "";
}

function statsLine(report: ReturnType<typeof analyze>, trends: number): string {
  const s = report.stats;
  return `${trends} 条趋势 · ${s.unique} 条证据 · ${s.sources} 个来源 · 审计 ${s.errors} 错误 ${s.warnings} 警告`;
}

function writeRun(
  outDir: string,
  report: ReturnType<typeof analyze>,
  deckPath: string,
  trendsPath: string,
): { files: string[]; book: TrendBook | null } {
  fs.mkdirSync(outDir, { recursive: true });
  const model = buildDeckModel(report, deckPath);
  const book = fs.existsSync(trendsPath)
    ? (JSON.parse(fs.readFileSync(trendsPath, "utf8")) as TrendBook)
    : null;
  if (book) {
    const findings = new Map(report.findings.map((finding) => [finding.claimId, finding]));
    const claims = new Map(report.claims.map((claim) => [claim.id, claim]));
    for (const trend of book.trends) {
      if (!trend.claim) continue;
      const finding = findings.get(trend.claim.id);
      const claim = claims.get(trend.claim.id);
      if (!finding || finding.status || !claim) {
        trend.claim = null;
        continue;
      }
      const { a, b } = finding.comparison;
      trend.claim = {
        id: finding.claimId,
        labelA: claim.windowA.label,
        labelB: claim.windowB.label,
        unitLabel: UNIT_LABEL[claim.unit],
        shareA: Number((a.share * 100).toFixed(1)),
        shareB: Number((b.share * 100).toFixed(1)),
        deltaPp: finding.comparison.deltaPp,
        nA: a.n,
        nB: b.n,
        kA: a.k,
        kB: b.k,
        confidence: finding.confidence,
      };
    }
  }
  const html = book ? renderMagazine(book, report, { assetPrefix: assetPrefixFor(outDir) }) : renderDeck(model);

  const files: [string, string][] = [
    ["deck.html", html],
    ["report.md", renderMarkdown(model)],
    ["report.json", renderJson(report)],
    ["evidence.csv", renderEvidenceCsv(report)],
    ["findings.csv", renderFindingsCsv(report)],
  ];
  if (book)
    files.push([
      "trends.md",
      renderTrendMarkdown(book, {
        assetPrefix: assetPrefixFor(outDir),
        findings: report.findings,
        claims: report.claims,
      }),
    ]);

  for (const [name, body] of files) fs.writeFileSync(path.join(outDir, name), body, "utf8");
  return { files: files.map(([n]) => path.join(outDir, n)), book };
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      input: { type: "string" },
      claims: { type: "string" },
      sources: { type: "string" },
      deck: { type: "string" },
      trends: { type: "string" },
      articles: { type: "string" },
      corpus: { type: "string" },
      out: { type: "string" },
      title: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  const command = positionals[0] ?? "demo";
  if (values.help || command === "help") {
    log(HELP.trim());
    return;
  }

  const modeDir = command === "ingest" ? "auto" : command === "demo" ? "demo" : "curated";
  const outDir = values.out ?? path.join(OUT_ROOT, modeDir);
  const trendsPath = values.trends ?? (command === "demo" ? "" : DEFAULTS.trends);
  const deckPath = values.deck ?? DEFAULTS.deck;
  const at = new Date().toISOString().slice(0, 16).replace("T", " ");

  const paths = {
    evidencePath: values.input ?? DEFAULTS.evidence,
    claimsPath: values.claims ?? DEFAULTS.claims,
    sourcesPath: values.sources ?? DEFAULTS.sources,
  };

  if (command === "validate") {
    const sources = loadSources(paths.sourcesPath);
    const ev = loadEvidenceFile(paths.evidencePath, sources);
    const claims = loadClaims(paths.claimsPath);
    log("✓ 三份输入均通过校验");
    log(`  来源 ${sources.length} 个｜证据 ${ev.evidence.length} 条｜命题 ${claims.length} 条`);
    return;
  }

  if (command === "ingest") {
    const file = values.articles ?? DEFAULTS.articles;
    if (!fs.existsSync(file)) {
      log(`✗ 找不到文章文件：${file}`);
      process.exitCode = 1;
      return;
    }
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const arts: Article[] = Array.isArray(raw) ? raw : raw.articles;
    const corpus = loadCorpus(values.corpus ?? DEFAULTS.corpus);
    const terms = termsFromCorpus(corpus.terms);
    const { book, report, stats } = extractTrends(arts, {
      terms,
      seasonLabel: values.title ?? "本期",
      intro: values.title
        ? `${values.title}：从 ${arts.length} 篇文章里抽取的趋势。`
        : `从 ${arts.length} 篇文章里自动抽取趋势，每条都能回链到原文。`,
    });

    fs.mkdirSync(outDir, { recursive: true });
    const pre = assetPrefixFor(outDir);
    const sumPath = path.join(values.corpus ?? DEFAULTS.corpus, "summary.json");
    const summary = fs.existsSync(sumPath)
      ? buildSummary(book, JSON.parse(fs.readFileSync(sumPath, "utf8")) as RawSummary)
      : undefined;
    const files: [string, string][] = [
      ["deck.html", renderMagazine(book, report, { assetPrefix: pre, summary })],
      ["trends.md", renderTrendMarkdown(book, { assetPrefix: pre, summary })],
      ["trends.json", JSON.stringify(book, null, 1)],
    ];
    for (const [name, body] of files) fs.writeFileSync(path.join(outDir, name), body, "utf8");

    updateSite({
      dir: relDir(outDir),
      kicker: "AUTO",
      title: "自动模式",
      desc: `投喂 ${stats.articles} 篇文章，自动抽取趋势，无人工干预。`,
      stats: `${stats.trends} 条趋势 · 覆盖 ${book.boards.length} 个板块 · 命中词 ${stats.terms} 个`,
      files: files.map(([n]) => n),
      at,
    });

    log("▶ ingest（自动抽取，不含编辑判断）");
    log("");
    log(`  文章 ${stats.articles} 篇　命中词 ${stats.terms} 个　生成趋势 ${stats.trends} 条`);
    for (const b of book.boards) {
      const items = book.trends.filter((t) => t.board === b.key).map((t) => t.name);
      if (items.length) log(`    ${b.name}：${items.join("、")}`);
    }
    log("");
    for (const [name] of files) log(`    ${path.join(outDir, name)}`);
    log("");
    return;
  }

  if (command === "demo" || command === "analyze") {
    const report = analyze({ ...paths, title: values.title });
    const { files, book } = writeRun(outDir, report, deckPath, trendsPath);
    updateSite({
      dir: relDir(outDir),
      kicker: command === "demo" ? "DEMO" : "CURATED",
      title: command === "demo" ? "示例数据" : "精细模式",
      desc:
        command === "demo"
          ? "合成数据，只用来验证链路，不能当结论。"
          : "人工编码证据，双时间窗对比，每条结论可回原文。",
      stats: statsLine(report, book?.trends.length ?? report.findings.length),
      files: files.map((f) => path.basename(f)),
      at,
    });

    log(command === "demo" ? "▶ demo（示例数据，非真实结论）" : "▶ analyze（精细模式）");
    log("");
    const s = report.stats;
    log(`  证据 ${s.evidence} 条 → 去重后 ${s.unique}（剔除 ${s.duplicates}）`);
    log(`  来源 ${s.sources} 个　结论 ${report.findings.length} 条　审计 ${s.errors} 错误 ${s.warnings} 警告`);
    for (const f of report.findings) {
      if (f.status) {
        log(`    · [${f.confidence}] ${f.claimId} ${f.statement}`);
        continue;
      }
      const sign = f.comparison.deltaPp > 0 ? "+" : "";
      log(`    · [${f.confidence}] ${f.claimId} ${sign}${f.comparison.deltaPp}pp  ${f.question}`);
    }
    log("");
    for (const f of files) log(`    ${f}`);
    log("");
    return;
  }

  if (command === "audit") {
    const sources = loadSources(paths.sourcesPath);
    const ev = loadEvidenceFile(paths.evidencePath);
    const claims = loadClaims(paths.claimsPath);
    const report = buildReport({
      claims,
      evidence: ev.evidence,
      sources,
      dataset: ev.dataset,
      synthetic: ev.synthetic,
      notes: ev.notes,
      inputs: {
        evidence: paths.evidencePath,
        claims: paths.claimsPath,
        sources: paths.sourcesPath,
      },
    });
    const s = summarize(report.audit);
    log(formatIssues(report.audit) || "未发现问题。");
    log("");
    log(`审计：${s.errors} 错误 / ${s.warnings} 警告 / ${s.infos} 提示`);
    if (s.errors > 0) process.exitCode = 1;
    return;
  }

  log(`未知命令：${command}`);
  log(HELP.trim());
  process.exitCode = 1;
}

try {
  main();
} catch (e) {
  log(`✗ ${(e as Error).message}`);
  process.exitCode = 1;
}
