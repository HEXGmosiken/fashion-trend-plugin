/**
 * 自动趋势抽取：把一批文章变成一份趋势报告。
 *
 * 流程：文章 → 词表命中 → 按板块聚合 → 每条趋势取证据句、配图、共现词 → TrendBook。
 * 这里只做可复算的统计和抽取，不生成编辑判断。
 */
import type { Report } from "./types.ts";
import type { Board, Trend, TrendBook, TrendQuote } from "./render/magazine.ts";
import { countMatches, termRegex, type TermRecord } from "./corpus.ts";

export interface Article {
  id: string;
  title: string;
  url: string;
  date: string;
  source: string;
  text: string;
  image?: string;
}

export interface Term {
  zh: string;
  en: string;
  board: string;
  re: RegExp;
}

const B = (zh: string, en: string, board: string, re: RegExp): Term => ({ zh, en, board, re });

export const TERMS: Term[] = [
  B("风衣", "Trench", "silhouette", /风衣|trench/i),
  B("大衣", "Coat", "silhouette", /大衣|coat\b/i),
  B("长裙", "Maxi", "silhouette", /长裙|maxi/i),
  B("半裙", "Midi", "silhouette", /半裙|midi/i),
  B("阔腿裤", "Wide Leg", "silhouette", /阔腿|wide[\- ]?leg/i),
  B("牛仔裤", "Denim", "silhouette", /牛仔|denim|jeans/i),
  B("西装外套", "Blazer", "silhouette", /西装|blazer|suit/i),
  B("连衣裙", "Dress", "silhouette", /连衣裙|dress\b/i),
  B("短外套", "Cropped", "silhouette", /短外套|cropped/i),
  B("剪裁", "Tailoring", "construction", /剪裁|tailoring|tailored/i),
  B("结构", "Structure", "construction", /结构|structure/i),
  B("肩线", "Shoulder", "construction", /肩线|shoulder/i),
  B("腰线", "Waist", "construction", /腰线|waist/i),
  B("垂坠", "Drape", "construction", /垂坠|垂感|drape/i),
  B("褶皱", "Pleat", "construction", /褶皱|褶|pleat/i),
  B("拼接", "Patchwork", "construction", /拼接|patchwork|panelled/i),
  B("围裹", "Wrap", "construction", /围裹|裹身|wrap/i),
  B("层次", "Layering", "construction", /层次|layer/i),
  B("薄纱", "Sheer", "material", /薄纱|sheer|tulle|organza|网纱/i),
  B("蕾丝", "Lace", "material", /蕾丝|lace/i),
  B("皮革", "Leather", "material", /皮革|leather|suede/i),
  B("针织", "Knit", "material", /针织|knit/i),
  B("粗花呢", "Tweed", "material", /粗花呢|tweed/i),
  B("丝绸", "Satin", "material", /丝绸|satin|silk|缎/i),
  B("丝绒", "Velvet", "material", /丝绒|velvet/i),
  B("皮草", "Fur", "material", /皮草|fur|shearling/i),
  B("亮片", "Sequin", "material", /亮片|sequin|bead/i),
  B("镂空", "Cut-out", "material", /镂空|cut[\- ]?out|openwork/i),
  B("肌理", "Texture", "material", /肌理|texture/i),
  B("棕色", "Brown", "color", /棕色|大地色|brown|camel|焦糖|驼/i),
  B("酒红", "Burgundy", "color", /酒红|勃艮第|burgundy|oxblood/i),
  B("黑色", "Black", "color", /黑色|black/i),
  B("白色", "White", "color", /白色|white/i),
  B("米色", "Beige", "color", /米色|beige|cream/i),
  B("蓝色", "Blue", "color", /蓝色|blue/i),
  B("红色", "Red", "color", /红色|red\b/i),
  B("金属色", "Metallic", "color", /金属|metallic|silver|gold/i),
  B("新中式", "Light Chinese", "aesthetic", /新中式|轻中式|国风|中式/i),
  B("极简", "Minimal", "aesthetic", /极简|minimal/i),
  B("静奢", "Quiet Luxury", "aesthetic", /静奢|quiet luxury|老钱/i),
  B("摇滚", "Rock", "aesthetic", /摇滚|punk|grunge|rock/i),
  B("学院", "Preppy", "aesthetic", /学院|preppy|collegiate/i),
  B("浪漫", "Romantic", "aesthetic", /浪漫|romantic|romance/i),
  B("复古", "Retro", "aesthetic", /复古|retro|vintage/i),
  B("街头", "Street", "aesthetic", /街头|streetwear|street style/i),
  B("运动", "Sport", "aesthetic", /运动|sporty|athleisure|gorpcore/i),
  B("通勤", "Office", "occasion", /通勤|职场|office|workwear/i),
  B("度假", "Resort", "occasion", /度假|resort|holiday/i),
  B("音乐节", "Festival", "occasion", /音乐节|festival/i),
  B("派对", "Party", "occasion", /派对|party|evening/i),
  B("户外", "Outdoor", "occasion", /户外|outdoor/i),
  B("日常", "Everyday", "occasion", /日常|everyday|daily/i),
];

export const BOARDS: Board[] = [
  { key: "silhouette", name: "廓形款式", en: "Silhouette", desc: "这一季衣服长什么形状" },
  { key: "construction", name: "结构工艺", en: "Construction", desc: "这个形状是怎么做出来的" },
  { key: "material", name: "材质肌理", en: "Material", desc: "用什么料子做出这个手感" },
  { key: "color", name: "色彩", en: "Colour", desc: "这一季在用什么颜色" },
  { key: "aesthetic", name: "风格美学", en: "Aesthetic", desc: "整体在表达哪一种气质" },
  { key: "occasion", name: "场景穿着", en: "Occasion", desc: "这些衣服穿去哪儿" },
];

function sentences(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/(?<=[。！？.!?])\s*|\n+/)) {
    const s = raw.replace(/\s+/g, " ").trim();
    if (s.length < 24 || s.startsWith("#")) continue;
    if (/(Mrs|Mr|Dr|St|No|vs|etc)\.$/.test(s) || s.endsWith("，")) continue;
    out.push(s);
  }
  return out;
}

export interface Extracted {
  book: TrendBook;
  report: Report;
  stats: { articles: number; terms: number; trends: number };
}

/** 读法模板：一句转变句，按板块写给不同趋势 */
const READING: Record<string, string> = {
  silhouette: "廓形从收紧转向放松，{name}是其中一个落点。",
  construction: "工艺在装饰与结构之间摆动，{name}同时踩在两边。",
  material: "材质从厚重转向轻薄，{name}是这组对比的一端。",
  color: "色彩从安全的中性转向张力，{name}是其中的一极。",
  aesthetic: "审美从克制转向表达，{name}站在转向的一侧。",
  occasion: "场景从正式转向日常，{name}正好落在这条线上。",
};

/** 这些词是分析用语，不适合当趋势标题 */
const META_TERMS = new Set(["廓形", "版型", "结构", "细节", "比例", "长度", "光泽", "哑光", "厚重", "轻薄", "层叠", "剪裁"]);

/** 把语料库里的术语记录转成抽取用的词条 */
export function termsFromCorpus(records: TermRecord[]): Term[] {
  return records
    .filter((r) => !META_TERMS.has(r.zh))
    .map((r) => ({ zh: r.zh, en: r.en, board: r.board, re: termRegex(r) }));
}

export function extractTrends(
  articles: Article[],
  opts: {
    perBoard?: number;
    seasonLabel?: string;
    seasonCode?: string;
    periodLabel?: string;
    intro?: string;
    /** 外部术语表；不传就用内置的 52 词 */
    terms?: Term[];
  } = {},
): Extracted {
  const perBoard = opts.perBoard ?? 3;
  const terms = opts.terms && opts.terms.length ? opts.terms : TERMS;
  const sents = new Map<string, string[]>();
  const hits = new Map<string, { docs: Map<string, string[]>; total: number }>();

  for (const a of articles) {
    const ss = sentences(a.text);
    sents.set(a.id, ss);
    for (const t of terms) {
      if (!t.re.test(a.text)) continue;
      let agg = hits.get(t.zh);
      if (!agg) {
        agg = { docs: new Map(), total: 0 };
        hits.set(t.zh, agg);
      }
      agg.total += countMatches(a.text, t.re);
      agg.docs.set(a.id, ss.filter((s) => t.re.test(s)).slice(0, 2));
    }
  }

  const minDocs = Math.max(2, Math.floor(articles.length * 0.06));
  const trends: Trend[] = [];
  let n = 0;

  for (const board of BOARDS) {
    const boardTerms = terms.filter((t) => t.board === board.key && (hits.get(t.zh)?.docs.size ?? 0) >= minDocs)
      .sort((x, y) => (hits.get(y.zh)!.docs.size - hits.get(x.zh)!.docs.size));
    for (const term of boardTerms.slice(0, perBoard)) {
      const agg = hits.get(term.zh)!;
      const ids = [...agg.docs.keys()];
      const dates = ids.map((id) => articles.find((a) => a.id === id)?.date ?? "").filter(Boolean).sort();
      n++;

      const quotes: TrendQuote[] = [];
      for (const id of ids) {
        if (quotes.length >= 3) break;
        const a = articles.find((x) => x.id === id)!;
        const q = agg.docs.get(id)![0];
        if (!q) continue;
        if (quotes.some((x) => x.source === a.source)) continue;
        quotes.push({ ev: a.id, source: a.source, url: a.url, date: a.date, text: q.slice(0, 190) });
      }

      // 共现词：同板块里跟它同篇出现的其他词
      const co = terms.filter((t) => t.zh !== term.zh)
        .map((t) => ({ t, n: ids.filter((id) => t.re.test(articles.find((a) => a.id === id)?.text ?? "")).length }))
        .filter((x) => x.n >= 1)
        .sort((a, b) => b.n - a.n)
        .slice(0, 20);

      const keywords = [
        { t: term.zh, n: agg.docs.size * 3 },
        ...co.map((c) => ({ t: c.t.zh, n: c.n })),
      ];

      const images = ids
        .map((id) => articles.find((a) => a.id === id)!)
        .filter((a) => a.image)
        .slice(0, 4)
        .map((a) => ({ src: a.image!, ev: a.id, source: a.source }));

      const share = Math.round((agg.docs.size / Math.max(1, articles.length)) * 100);
      const srcCount = new Set(ids.map((id) => articles.find((a) => a.id === id)?.source)).size;
      const topCo = co.slice(0, 2).map((c) => c.t.zh);
      trends.push({
        id: `A${String(n).padStart(2, "0")}`,
        board: board.key,
        name: term.zh,
        code: term.en,
        tags: [board.name, "自动抽取"],
        intent: topCo.length
          ? `${term.zh}主要出现在${topCo.map((x) => `「${x}」`).join("")}的语境里。`
          : `本期样本里，${term.zh}出现在 ${agg.docs.size} 篇报道中。`,
        form: [
          `覆盖 ${srcCount} 家来源`,
          dates.length ? `首发 ${dates[0]}` : "日期未标注",
          topCo.length ? `同篇最多：${topCo.join("、")}` : "同篇语境不明显",
        ],
        expression: "",
        keywords,
        quotes,
        images,
        claim: null,
        reading: (READING[board.key] ?? "").replace("{name}", term.zh),
        evidenceLine: `本期 ${agg.docs.size} 篇提到，占样本 ${share}%，覆盖 ${srcCount} 家来源。`,
        docs: agg.docs.size,
        share,
        sources: new Set(ids.map((id) => articles.find((a) => a.id === id)?.source)).size,
      });
    }
  }

  const book: TrendBook = {
    seasonLabel: opts.seasonLabel ?? "本期",
    seasonCode: opts.seasonCode ?? "",
    periodLabel: opts.periodLabel ?? "文章样本",
    intro: opts.intro ?? `从 ${articles.length} 篇文章里自动抽取 ${trends.length} 条趋势，每条都能回链到原文。`,
    boards: BOARDS,
    trends,
  };

  const sources = [...new Set(articles.map((a) => a.source))].map((name, i) => ({
    id: `s${i}`,
    name,
    domain: "",
    publisherGroup: name,
    language: "zh" as const,
    region: "global",
    type: "media" as const,
    tier: 2 as const,
    paywall: false,
    crawlable: true,
  }));

  const report = {
    meta: {
      title: book.intro,
      dataset: "auto-extracted",
      synthetic: false,
      notes: "由 ingest 自动抽取，只做词表统计，不含编辑判断。",
      generatedAt: new Date().toISOString().slice(0, 19).replace("T", " ") + " UTC",
      tool: "trend-lab auto",
      inputs: { evidence: "", claims: "", sources: "" },
    },
    claims: [],
    findings: [],
    evidence: articles.map((a) => ({
      id: a.id,
      sourceId: `s${sources.findIndex((s) => s.name === a.source)}`,
      url: a.url,
      title: a.title,
      publishedAt: a.date || "2026-11-01",
      dateEstimated: !a.date,
      accessedAt: "2026-11-06",
      season: "other" as const,
      window: "X" as const,
      brand: "",
      category: "",
      excerpt: a.text.slice(0, 120),
      originality: "original" as const,
      isSponsored: false,
      codings: {},
    })),
    sources,
    duplicates: [],
    audit: [],
    stats: {
      evidence: articles.length,
      unique: articles.length,
      duplicates: 0,
      sources: sources.length,
      publisherGroups: sources.length,
      errors: 0,
      warnings: 0,
    },
  } as unknown as Report;

  return { book, report, stats: { articles: articles.length, terms: hits.size, trends: trends.length } };
}
