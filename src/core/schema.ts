/**
 * 数据契约层。
 *
 * 设计原则：
 * 1. 输入（来源 / 证据 / 命题）全部用 Zod 校验，坏数据在入口就断掉；
 * 2. 输出（指标 / 结论 / 审计 / 报告）用普通 TS 接口，便于渲染与序列化；
 * 3. 所有「判断」字段（tier、originality、coding）都要求人工填写，机器不猜。
 */
import { z } from "zod";

const DateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日期必须是 YYYY-MM-DD");

const HttpUrl = z.string().refine((v) => {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}, "必须是 http(s) 链接");

/** 来源类型：决定它在证据链里的权重，不是「好不好看」 */
export const SourceTypeSchema = z.enum([
  "runway", // 秀场 / 品牌官方发布
  "media", // 行业媒体、时装媒体
  "trade", // 供应链、面料、纺织
  "forecast", // 趋势预测机构
  "commerce", // 电商、零售、平台数据
  "social", // 社媒、街拍
  "brand", // 品牌投放 / 新闻稿
]);

export const LanguageSchema = z.enum(["en", "zh", "other"]);
export const OriginalitySchema = z.enum(["original", "reprint", "translation"]);
export const SeasonSchema = z.enum(["FW25", "SS26", "FW26", "SS27", "other"]);
export const WindowKeySchema = z.enum(["A", "B", "X"]);

export const SourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  domain: z.string().min(3),
  /** 同一集团 / 同一母站的不同版本，用于去重，避免「Vogue US/UK/AU 算三个来源」 */
  publisherGroup: z.string().min(1),
  language: LanguageSchema,
  region: z.string().default("global"),
  type: SourceTypeSchema,
  /** 1=一手（秀场/官方），2=专业媒体，3=聚合/门户/自媒体 */
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  paywall: z.boolean().default(false),
  crawlable: z.boolean().default(true),
});
export type Source = z.infer<typeof SourceSchema>;

export const CodingValueSchema = z.union([z.boolean(), z.number(), z.string()]);
export type CodingValue = z.infer<typeof CodingValueSchema>;
export const CodingSchema = z.record(z.string(), CodingValueSchema);

export const EvidenceSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  url: HttpUrl,
  title: z.string().min(4),
  /** 原文发布时间；不知道就填抓取日，并把 dateEstimated 置 true */
  publishedAt: DateStr,
  /** 发布日期是否为估算值（原文没标日期） */
  dateEstimated: z.boolean().default(false),
  accessedAt: DateStr,
  season: SeasonSchema,
  /** 人工归入哪个时间窗；X = 不进任何命题（零售/数据/泛趋势稿），审计会拿日期反查是否矛盾 */
  window: WindowKeySchema,
  brand: z.string().default(""),
  category: z.string().default(""),
  /** 原文里能直接复制出来的一句话，用于人工复核 */
  excerpt: z.string().min(10),
  imageUrl: HttpUrl.optional(),
  originality: OriginalitySchema.default("original"),
  isSponsored: z.boolean().default(false),
  /** 人工编码：key → 是否具备该特征。机器只统计，不判断 */
  codings: CodingSchema.default({}),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const WindowSchema = z
  .object({
    label: z.string().min(1),
    /** 这个窗口对应的「主题季」，用于校验证据的 season 是否归类正确 */
    season: SeasonSchema,
    start: DateStr,
    end: DateStr,
  })
  .refine((w) => w.start <= w.end, "时间窗 start 不能晚于 end");
export type Window = z.infer<typeof WindowSchema>;

export const ClaimSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(8),
  /** 对应 codings 里的键，例如 "sheer" */
  signal: z.string().min(1),
  /** 信号的人话名称，用于生成结论句；留空则直接显示 key */
  signalLabel: z.string().default(""),
  /** 分析单位，决定分母的含义 */
  unit: z.enum(["show", "look", "article", "product"]),
  windowA: WindowSchema,
  windowB: WindowSchema,
  direction: z.enum(["up", "down", "change"]),
  /** 两个时间窗各自的最小样本量，低于此值不出结论 */
  minN: z.number().int().positive().default(15),
  sampleScope: z.object({
    brands: z.array(z.string()).default([]),
    sourceTypes: z.array(SourceTypeSchema).default([]),
    include: z.array(z.string()).default([]),
    exclude: z.array(z.string()).default([]),
  }),
  /** 冻结的编码规则。空 = 没冻结 = 不许出结论 */
  codingRule: z.string().min(10),
  /** 已知反证或替代解释，人工填写 */
  counterNote: z.string().default(""),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const SourcesFileSchema = z.object({
  sources: z.array(SourceSchema).min(1),
});
export const EvidenceFileSchema = z.object({
  dataset: z.string().min(1),
  /** true = 合成演示数据，报告中强制打水印 */
  synthetic: z.boolean().default(false),
  /** 数据说明：采集方式、编码方式、已知偏差，会原样印在报告开头 */
  notes: z.string().default(""),
  evidence: z.array(EvidenceSchema).min(1),
});
export const ClaimsFileSchema = z.object({
  claims: z.array(ClaimSchema).min(1),
});

/* ------------------------------------------------------------------ */
/* 展示配置：与数据分开。换数据不用动它，换版式不用碰分析              */
/* ------------------------------------------------------------------ */

export const PaletteSchema = z.object({
  paper: z.string().min(4),
  accent: z.string().min(4),
  ink: z.string().min(4),
});
export type Palette = z.infer<typeof PaletteSchema>;

export const DeckClaimSchema = z.object({
  /** 6 到 10 字的中文趋势名，做主标题 */
  title: z.string().min(2),
  /** 两个并列关键词，界面上用一个斜杠连接，这是唯一允许出现斜杠的位置 */
  kwA: z.string().default(""),
  kwB: z.string().default(""),
  palette: PaletteSchema.optional(),
});

export const DeckConfigSchema = z.object({
  seasonLabel: z.string().min(2),
  seasonCode: z.string().min(3),
  periodLabel: z.string().min(2),
  coverTitle: z.string().min(2),
  coverSub: z.string().default(""),
  claims: z.record(z.string(), DeckClaimSchema).default({}),
});
export type DeckConfig = z.infer<typeof DeckConfigSchema>;
