/** 归一化与去重：URL、标题、发布日期、publisher group。 */
import type { Evidence, Source } from "./schema.ts";
import type { DuplicateHit } from "./types.ts";

const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "fbclid", "spm", "from", "share_token", "ref", "ref_src",
]);

/** 把 URL 压成可比较的规范形式：去 hash、去跟踪参数、排序 query、去尾斜杠 */
export function canonicalUrl(raw: string): string {
  const u = new URL(raw);
  u.hash = "";
  const kept: [string, string][] = [];
  for (const [k, v] of u.searchParams.entries()) {
    const lk = k.toLowerCase();
    if (TRACKING_PARAMS.has(lk) || lk.startsWith("utm_")) continue;
    kept.push([k, v]);
  }
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  u.search = "";
  for (const [k, v] of kept) u.searchParams.append(k, v);
  u.pathname = u.pathname.replace(/\/+$/, "") || "/";
  return u.toString();
}

/** 标题归一：小写、全半角统一、去掉标点与空白差异 */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['\u2018\u2019]/g, "")
    .replace(/\p{Script=Latin}/gu, (letter) => letter.normalize("NFD").replace(/\p{M}/gu, ""))
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function titleTokens(title: string): Set<string> {
  const words = normalizeTitle(title).split(" ").filter((w) => w.length > 1 || /\p{N}/u.test(w));
  return new Set(words);
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** 以真实稿件对校验过的标题相似度下限，见 docs/去重阈值校准.md。 */
export const DEDUP_TITLE_THRESHOLDS = {
  "same-publisher": 0.85,
  "cross-publisher": 0.92,
} as const;

type TitleMatch = keyof typeof DEDUP_TITLE_THRESHOLDS;

interface TitleCandidate {
  evidence: Evidence;
  group: string;
  tokens: Set<string>;
  index: number;
}

function dedupeByTitle(
  items: TitleCandidate[],
  reason: TitleMatch,
  duplicates: DuplicateHit[],
): TitleCandidate[] {
  const kept: TitleCandidate[] = [];
  for (const item of items) {
    let match: DuplicateHit | undefined;
    for (const other of kept) {
      if ((item.group === other.group) !== (reason === "same-publisher")) continue;
      if (item.tokens.size === 0 || other.tokens.size === 0) continue;
      // 不同媒体的独立报道可能使用完全相同的秀场标题。
      if (reason === "cross-publisher" && item.evidence.originality === "original" &&
          other.evidence.originality === "original") continue;
      const { season } = item.evidence;
      if (season !== "other" && other.evidence.season !== "other" && season !== other.evidence.season) {
        continue;
      }
      const similarity = jaccard(item.tokens, other.tokens);
      if (similarity >= DEDUP_TITLE_THRESHOLDS[reason]) {
        match = { id: item.evidence.id, duplicateOf: other.evidence.id, reason, similarity };
        break;
      }
    }
    if (match) duplicates.push(match);
    else kept.push(item);
  }
  return kept;
}

/**
 * 去重分三层，顺序不能反：
 * 1. 同一 canonical URL → 硬重复
 * 2. 同 publisher group + 标题相似 → 同站不同版本
 * 3. 跨 publisher group + 标题高度相似 + 一方标记为非原创 → 转载
 */
export function dedupeEvidence(
  items: Evidence[],
  sourcesById: Map<string, Source>,
): { unique: Evidence[]; duplicates: DuplicateHit[] } {
  // 避免先录入的投放稿或转载挤掉可用的独立样本。质量相同时保留原顺序。
  const ranked = items.map((evidence, index) => {
    const source = sourcesById.get(evidence.sourceId);
    const promotional = evidence.isSponsored || source?.type === "brand";
    const rank = Number(!promotional) * 2 + Number(evidence.originality === "original");
    return { evidence, group: source?.publisherGroup ?? evidence.sourceId, rank, index };
  }).sort((a, b) => b.rank - a.rank);
  const candidates: TitleCandidate[] = [];
  const duplicates: DuplicateHit[] = [];
  const byUrl = new Map<string, Evidence>();

  for (const { evidence: ev, group, index } of ranked) {
    const url = canonicalUrl(ev.url);
    const hit = byUrl.get(url);
    if (hit) {
      duplicates.push({ id: ev.id, duplicateOf: hit.id, reason: "same-url", similarity: 1 });
      continue;
    }
    byUrl.set(url, ev);
    candidates.push({
      evidence: ev,
      group,
      tokens: titleTokens(ev.title),
      index,
    });
  }

  const withinGroup = dedupeByTitle(candidates, "same-publisher", duplicates);
  const acrossGroups = dedupeByTitle(withinGroup, "cross-publisher", duplicates);
  const unique = acrossGroups.sort((a, b) => a.index - b.index).map(({ evidence }) => evidence);
  return { unique, duplicates };
}

/** 判断证据日期是否落在某个时间窗内 */
export function inWindow(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

/** 某条证据按日期「应该」落在哪个窗口；A/B 都不在则返回 null */
export function impliedWindow(
  date: string,
  a: { start: string; end: string },
  b: { start: string; end: string },
): "A" | "B" | null {
  if (inWindow(date, a.start, a.end)) return "A";
  if (inWindow(date, b.start, b.end)) return "B";
  return null;
}
