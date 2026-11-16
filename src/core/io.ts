/** 输入读取：JSON 解析 + Zod 校验，错误信息直指字段路径。 */
import fs from "node:fs";
import type { ZodType } from "zod";
import {
  ClaimsFileSchema,
  DeckConfigSchema,
  EvidenceFileSchema,
  SourcesFileSchema,
  type Claim,
  type DeckConfig,
  type Evidence,
  type Source,
} from "./schema.ts";

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

function parseFile<T>(path: string, schema: ZodType): T {
  if (!fs.existsSync(path)) throw new InputError(`找不到文件：${path}`);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (e) {
    throw new InputError(`${path} 不是合法 JSON：${(e as Error).message}`);
  }
  const res = schema.safeParse(raw);
  if (!res.success) {
    const lines = res.error.issues.slice(0, 12).map((i) => `  · ${i.path.join(".") || "(root)"}：${i.message}`);
    const more = res.error.issues.length > 12 ? `\n  ……另有 ${res.error.issues.length - 12} 处` : "";
    throw new InputError(`${path} 未通过校验：\n${lines.join("\n")}${more}`);
  }
  return res.data as T;
}

export function loadSources(path: string): Source[] {
  return parseFile<{ sources: Source[] }>(path, SourcesFileSchema).sources;
}

export function loadEvidenceFile(path: string): { dataset: string; synthetic: boolean; notes: string; evidence: Evidence[] } {
  return parseFile<{ dataset: string; synthetic: boolean; notes: string; evidence: Evidence[] }>(path, EvidenceFileSchema);
}

export function loadClaims(path: string): Claim[] {
  return parseFile<{ claims: Claim[] }>(path, ClaimsFileSchema).claims;
}

/** 没有配置文件也能出报告，用这套默认版式 */
export const DEFAULT_DECK: DeckConfig = {
  seasonLabel: "2027 春夏",
  seasonCode: "2027 S/S",
  periodLabel: "2026 年第四季度",
  coverTitle: "女装趋势观察",
  coverSub: "把一季的报道拆成几条能复核的判断。",
  claims: {},
};

export function loadDeckConfig(path: string): DeckConfig {
  if (!fs.existsSync(path)) return DEFAULT_DECK;
  return parseFile<DeckConfig>(path, DeckConfigSchema);
}
