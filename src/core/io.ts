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

function parseFile<T>(path: string, schema: ZodType<T>): T {
  let content: string;
  try {
    content = fs.readFileSync(path, "utf8");
  } catch (e) {
    const error = e as NodeJS.ErrnoException;
    throw new InputError(error.code === "ENOENT"
      ? `找不到文件：${path}`
      : `无法读取 ${path}：${error.message}`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(content.replace(/^\uFEFF/, ""));
  } catch (e) {
    throw new InputError(`${path} 不是合法 JSON：${(e as Error).message}`);
  }
  const res = schema.safeParse(raw);
  if (!res.success) {
    const lines = res.error.issues.slice(0, 12).map((i) => `  · ${i.path.join(".") || "(root)"}：${i.message}`);
    const more = res.error.issues.length > 12 ? `\n  ……另有 ${res.error.issues.length - 12} 处` : "";
    throw new InputError(`${path} 未通过校验：\n${lines.join("\n")}${more}`);
  }
  return res.data;
}

export function loadSources(path: string): Source[] {
  return parseFile(path, SourcesFileSchema).sources;
}

export function loadEvidenceFile(path: string, sources?: readonly Source[]): {
  dataset: string; synthetic: boolean; notes: string; evidence: Evidence[];
} {
  if (!sources) return parseFile(path, EvidenceFileSchema);

  const sourceIds = new Set(sources.map((source) => source.id));
  return parseFile(path, EvidenceFileSchema.superRefine(({ evidence }, ctx) => {
    for (const [index, entry] of evidence.entries()) {
      if (!sourceIds.has(entry.sourceId)) {
        ctx.addIssue({
          code: "custom",
          path: ["evidence", index, "sourceId"],
          message: `来源「${entry.sourceId}」未在来源注册表登记`,
        });
      }
    }
  }));
}

export function loadClaims(path: string): Claim[] {
  return parseFile(path, ClaimsFileSchema).claims;
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
  return parseFile(path, DeckConfigSchema);
}
