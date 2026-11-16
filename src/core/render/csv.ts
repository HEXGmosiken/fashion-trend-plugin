/** CSV 渲染：给 Excel / pandas 用的平面表。 */
import type { Report } from "../types.ts";

function cell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(cells: unknown[]): string {
  return cells.map(cell).join(",");
}

export function renderEvidenceCsv(r: Report): string {
  const head = [
    "id", "sourceId", "source", "tier", "title", "url", "publishedAt", "accessedAt",
    "window", "season", "brand", "category", "originality", "isSponsored", "codings", "excerpt",
  ];
  const lines = [row(head)];
  const tierOf = new Map(r.sources.map((s) => [s.id, s.tier]));
  const nameOf = new Map(r.sources.map((s) => [s.id, s.name]));
  for (const e of r.evidence) {
    lines.push(
      row([
        e.id, e.sourceId, nameOf.get(e.sourceId) ?? "", tierOf.get(e.sourceId) ?? "",
        e.title, e.url, e.publishedAt, e.accessedAt,
        e.window, e.season, e.brand, e.category, e.originality, e.isSponsored,
        JSON.stringify(e.codings), e.excerpt,
      ]),
    );
  }
  return lines.join("\n") + "\n";
}

export function renderFindingsCsv(r: Report): string {
  const head = [
    "claimId", "confidence", "question", "shareA", "kA", "nA", "ciA",
    "shareB", "kB", "nB", "ciB", "deltaPp", "ciOverlap",
    "supportCount", "counterCount", "statement",
  ];
  const lines = [row(head)];
  for (const f of r.findings) {
    const c = f.comparison;
    lines.push(
      row([
        f.claimId, f.confidence, f.question,
        (c.a.share * 100).toFixed(1), c.a.k, c.a.n, `${(c.a.ciLow * 100).toFixed(1)}-${(c.a.ciHigh * 100).toFixed(1)}`,
        (c.b.share * 100).toFixed(1), c.b.k, c.b.n, `${(c.b.ciLow * 100).toFixed(1)}-${(c.b.ciHigh * 100).toFixed(1)}`,
        c.deltaPp, c.ciOverlap,
        f.support.length, f.counter.length, f.statement,
      ]),
    );
  }
  return lines.join("\n") + "\n";
}
