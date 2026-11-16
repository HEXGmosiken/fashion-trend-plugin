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
  let out = u.toString();
  if (u.pathname !== "/") out = out.replace(/\/+$/, "");
  return out;
}

/** 标题归一：小写、全半角统一、去掉标点与空白差异 */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function titleTokens(title: string): Set<string> {
  const words = normalizeTitle(title).split(" ").filter((w) => w.length > 1);
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

/**
 * 去重分三层，顺序不能反：
 * 1. 同一 canonical URL → 硬重复
 * 2. 同 publisher group + 标题相似 → 同站不同版本
 * 3. 跨 publisher group + 标题高度相似 → 转载
 */
export function dedupeEvidence(
  items: Evidence[],
  sourcesById: Map<string, Source>,
): { unique: Evidence[]; duplicates: DuplicateHit[] } {
  const unique: Evidence[] = [];
  const duplicates: DuplicateHit[] = [];
  const byUrl = new Map<string, Evidence>();
  const tokens = new Map<string, Set<string>>();

  for (const ev of items) {
    const url = canonicalUrl(ev.url);
    const hit = byUrl.get(url);
    if (hit) {
      duplicates.push({ id: ev.id, duplicateOf: hit.id, reason: "same-url", similarity: 1 });
      continue;
    }
    byUrl.set(url, ev);
    tokens.set(ev.id, titleTokens(ev.title));
    unique.push(ev);
  }

  const kept: Evidence[] = [];
  for (const ev of unique) {
    const group = sourcesById.get(ev.sourceId)?.publisherGroup ?? ev.sourceId;
    const tk = tokens.get(ev.id)!;
    let matched: { id: string; reason: DuplicateHit["reason"]; sim: number } | null = null;

    for (const other of kept) {
      const otherGroup = sourcesById.get(other.sourceId)?.publisherGroup ?? other.sourceId;
      const sim = jaccard(tk, tokens.get(other.id)!);
      const sameGroup = group === otherGroup;
      if (sameGroup && sim >= 0.85) {
        matched = { id: other.id, reason: "same-publisher", sim };
        break;
      }
      if (!sameGroup && sim >= 0.92) {
        matched = { id: other.id, reason: "cross-publisher", sim };
        break;
      }
    }

    if (matched) {
      duplicates.push({
        id: ev.id,
        duplicateOf: matched.id,
        reason: matched.reason,
        similarity: Number(matched.sim.toFixed(3)),
      });
      continue;
    }
    kept.push(ev);
  }

  return { unique: kept, duplicates };
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
