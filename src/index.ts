/**
 * 对外 API：主项目只需要 import 这一个文件。
 *
 *   import { analyze, render } from "trend-lab";
 *   const report = analyze({ evidencePath, claimsPath, sourcesPath });
 *   const html = render.deck(report, deckConfig);
 */
import { loadClaims, loadDeckConfig, loadEvidenceFile, loadSources } from "./core/io.ts";
import { buildReport } from "./core/report.ts";
import { buildDeck } from "./core/present.ts";
import { renderMarkdown } from "./core/render/markdown.ts";
import { renderDeck } from "./core/render/deck.ts";
import { renderEvidenceCsv, renderFindingsCsv } from "./core/render/csv.ts";
import { renderJson } from "./core/render/json.ts";
import type { DeckConfig } from "./core/schema.ts";
import type { DeckModel } from "./core/present.ts";
import type { Report } from "./core/types.ts";

export interface AnalyzeOptions {
  evidencePath: string;
  claimsPath: string;
  sourcesPath: string;
  deckPath?: string;
  title?: string;
  today?: string;
}

export function analyze(opts: AnalyzeOptions): Report {
  const sources = loadSources(opts.sourcesPath);
  const { dataset, synthetic, notes, evidence } = loadEvidenceFile(opts.evidencePath, sources);
  const claims = loadClaims(opts.claimsPath);

  return buildReport({
    claims,
    evidence,
    sources,
    dataset,
    synthetic,
    notes,
    title: opts.title,
    inputs: {
      evidence: opts.evidencePath,
      claims: opts.claimsPath,
      sources: opts.sourcesPath,
    },
    today: opts.today,
  });
}

export function buildDeckModel(report: Report, deckPath = "data/deck.config.json"): DeckModel {
  return buildDeck(report, loadDeckConfig(deckPath));
}

export const render = {
  markdown: (report: Report, deckPath?: string) => renderMarkdown(buildDeckModel(report, deckPath)),
  deck: (report: Report, deckPath?: string) => renderDeck(buildDeckModel(report, deckPath)),
  json: renderJson,
  evidenceCsv: renderEvidenceCsv,
  findingsCsv: renderFindingsCsv,
};

export type { Report } from "./core/types.ts";
export type { DeckConfig, Claim, Evidence, Source } from "./core/schema.ts";
export type { DeckModel } from "./core/present.ts";
