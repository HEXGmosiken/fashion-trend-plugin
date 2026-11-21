import { inWindow } from "./normalize.ts";
import type { Claim, Evidence, Source } from "./schema.ts";

export type SampleExclusion = "window" | "season" | "date" | "brand" | "sourceType" | "unknownSource" | "advertising";

function brandKey(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function isPromotional(evidence: Evidence, source?: Source): boolean {
  return evidence.isSponsored || source?.type === "brand";
}

/** 只检查结构化条件。sampleScope.include/exclude 的自然语言条件由人工验收。 */
export function sampleExclusions(
  ev: Evidence,
  claim: Claim,
  sourcesById?: ReadonlyMap<string, Source>,
): SampleExclusion[] {
  const reasons: SampleExclusion[] = [];
  if (ev.window === "X") {
    reasons.push("window");
  } else {
    const window = ev.window === "A" ? claim.windowA : claim.windowB;
    // 两个窗口可在日历上重叠。用标注的主题季和窗口分别校验日期。
    if (ev.season !== window.season) reasons.push("season");
    if (!inWindow(ev.publishedAt, window.start, window.end)) reasons.push("date");
  }

  const scope = claim.sampleScope;
  if (scope.brands.length > 0 && !scope.brands.some((brand) => brandKey(brand) === brandKey(ev.brand))) {
    reasons.push("brand");
  }

  const source = sourcesById?.get(ev.sourceId);
  if (sourcesById && !source) reasons.push("unknownSource");
  if (source && scope.sourceTypes.length > 0 && !scope.sourceTypes.includes(source.type)) {
    reasons.push("sourceType");
  }
  if (isPromotional(ev, source)) reasons.push("advertising");
  return reasons;
}
