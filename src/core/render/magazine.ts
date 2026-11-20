/** 趋势报告版式：一屏一条趋势，图文并茂。 */
import type { Report } from "../types.ts";
import { layoutCloud, type MaskName } from "../shapecloud.ts";
import type { SummaryModel } from "../summary.ts";

export interface TrendQuote {
  ev: string;
  source: string;
  url: string;
  date: string;
  text: string;
}
export interface TrendImage {
  src: string;
  w?: number;
  h?: number;
  source?: string;
  ev?: string;
}
export interface TrendClaim {
  id: string;
  labelA?: string;
  labelB?: string;
  unitLabel?: string;
  deltaPp?: number;
  shareA: number;
  shareB: number;
  nA: number;
  nB: number;
  kA: number;
  kB: number;
  confidence: "high" | "medium" | "low";
}
export interface Trend {
  id: string;
  board: string;
  name: string;
  code: string;
  tags: string[];
  intent: string;
  form: string[];
  expression: string;
  keywords: { t: string; n: number }[];
  quotes: TrendQuote[];
  images: TrendImage[];
  claim: TrendClaim | null;
  /** 自动抽取时的样本数 */
  docs?: number;
  /** 占样本比例，0-100 */
  share?: number;
  /** 编辑读法：一句转变句，标为读法而非事实 */
  reading?: string;
  /** 数据句 */
  evidenceLine?: string;
  sources?: number;
}
export interface Board {
  key: string;
  name: string;
  en: string;
  desc: string;
}
export interface TrendBook {
  seasonLabel: string;
  seasonCode: string;
  periodLabel: string;
  intro: string;
  boards: Board[];
  trends: Trend[];
}

const ACCENT: Record<string, { ink: string; accent: string; paper: string }> = {
  silhouette: { accent: "#4F7484", ink: "#16242A", paper: "#EFF3F4" },
  construction: { accent: "#6B5B4A", ink: "#221C16", paper: "#F5F1EA" },
  material: { accent: "#72657F", ink: "#201B24", paper: "#F3F0F4" },
  color: { accent: "#8A1C2B", ink: "#241315", paper: "#F6EFEA" },
  aesthetic: { accent: "#2F3B33", ink: "#161C18", paper: "#EEF1EC" },
  occasion: { accent: "#4A5A4E", ink: "#1A211C", paper: "#F0F2ED" },
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const CLOUD_MASK: Record<string, MaskName> = {
  silhouette: "heart",
  construction: "heart",
  material: "heart",
  color: "heart",
  aesthetic: "heart",
  occasion: "heart",
};

function cloud(kws: { t: string; n: number }[], board: string): string {
  const W = 460;
  const H = 340;
  const layout = layoutCloud(kws, { width: W, height: H, mask: CLOUD_MASK[board] ?? "heart" });
  return layout.words
    .map((w) => {
      const left = ((w.x / W) * 100).toFixed(2);
      const top = ((w.y / H) * 100).toFixed(2);
      const fs = ((w.size / W) * 100).toFixed(2);
      return `<span style="left:${left}%;top:${top}%;font-size:${fs}cqw;font-weight:${w.weight}">${esc(w.t)}</span>`;
    })
    .join("");
}

function momentum(c: TrendClaim | null): string {
  if (!c) return "";
  const d = c.deltaPp ?? c.shareB - c.shareA;
  const dir = d > 0 ? "up" : d < 0 ? "down" : "flat";
  const label = d === 0 ? "基本持平" : `${Math.abs(d)} 点`;
  return `
    <div class="momentum ${dir}">
      <div class="mom-top">
        <span class="arrow">${d > 0 ? "↗" : d < 0 ? "↘" : "→"}</span>
        <span class="mom-num">${label}</span>
      </div>
      <p class="mom-cap">两窗样本占比</p>
      <div class="mom-bars">
        <div><span>${esc(c.labelA ?? "2026 秋冬")}</span><i style="width:${c.shareA}%"></i><b>${c.shareA}%</b></div>
        <div><span>${esc(c.labelB ?? "2027 春夏")}</span><i style="width:${c.shareB}%"></i><b>${c.shareB}%</b></div>
      </div>
      <p class="mom-note">样本 ${c.nA} ${esc(c.unitLabel ?? "篇")}对 ${c.nB} ${esc(c.unitLabel ?? "篇")}</p>
    </div>`;
}

/** 图片路径统一按「仓库根目录」存储，渲染时按输出目录补前缀 */
function assetSrc(path: string, prefix: string): string {
  if (/^(https?:|data:)/.test(path)) return path;
  const clean = path.replace(/^(\.\.\/)+/, "");
  return prefix + clean;
}

function trendPage(
  t: Trend,
  i: number,
  boards: Board[],
  total: number,
  prefix: string,
  prevId?: string,
  nextId?: string,
): string {
  const board = boards.find((b) => b.key === t.board);
  const theme = ACCENT[t.board] ?? ACCENT.silhouette!;
  const quotes = t.quotes
    .map(
      (q) => `
      <figure class="quote">
        <blockquote>${esc(q.text)}</blockquote>
        <figcaption><a href="${esc(q.url)}" target="_blank" rel="noreferrer">${esc(q.source)}</a><span>${esc(q.date)}</span></figcaption>
      </figure>`,
    )
    .join("");

  return `
  <section class="trend" id="${t.id}" style="--accent:${theme.accent};--ink:${theme.ink};--paper:${theme.paper}">
    <div class="hero">
      ${t.images[0] ? `<img src="${esc(assetSrc(t.images[0].src, prefix))}" alt="${esc(t.name)}" loading="eager" fetchpriority="high" onerror="this.style.visibility='hidden'" />` : ""}
      <div class="hero-tag"><span>${esc(board?.name ?? "")}</span><span>${String(i + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}</span></div>
    </div>

    <div class="inner">
      <header class="thead">
        <h2>${esc(t.name)}</h2>
        <p class="en">${esc(t.code)}</p>
        <p class="tags">${t.tags.map((x) => `<span>${esc(x)}</span>`).join("")}</p>
      </header>

      <div class="grid">
        <div class="copy">
          ${t.reading ? `<p class="reading">${esc(t.reading)}</p>` : ""}
          <p class="intent">${esc(t.intent)}</p>
          ${t.evidenceLine ? `<p class="evidence-line">${esc(t.evidenceLine)}</p>` : ""}
          <ol class="form">
            ${t.form.map((f) => `<li>${esc(f)}</li>`).join("")}
          </ol>
          ${t.expression ? `<p class="expr">${esc(t.expression)}</p>` : ""}
        </div>
        <aside class="viz">
          <p class="viz-cap">语料高频词</p>
          <div class="cloud">${cloud(t.keywords, t.board)}</div>
          ${momentum(t.claim)}
        </aside>
      </div>

      <div class="strip">
        ${t.images
          .slice(1, 4)
          .map((im) => `<figure class="shot"><img src="${esc(assetSrc(im.src, prefix))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'" /><figcaption>${esc(im.source ?? "")}</figcaption></figure>`)
          .join("")}
      </div>

      <div class="quotes">${quotes}</div>

      <nav class="pager">
        ${prevId ? `<a href="#${prevId}">← 上一条</a>` : "<span></span>"}
        ${nextId ? `<a href="#${nextId}">下一条 →</a>` : "<span></span>"}
      </nav>
    </div>
  </section>`;
}

function indexPage(book: TrendBook): string {
  const brushes = book.boards
    .map((b, i) => {
      const items = book.trends.filter((t) => t.board === b.key);
      const theme = ACCENT[b.key] ?? ACCENT.silhouette!;
      return `
      <a class="brush" href="#${items[0]?.id ?? ""}" style="--accent:${theme.accent}"
         aria-label="${esc(b.name)}，${items.length} 条趋势">
        <span class="brush-bg" aria-hidden="true"></span>
        <span class="brush-name">${esc(b.name)}</span>
        <span class="brush-en">${esc(b.en)}</span>
        <span class="brush-count">${items.length}</span>
      </a>`;
    })
    .join("");

  return `
  <section class="index">
    <div class="inner">
      <p class="eyebrow">目录</p>
      <h2 class="index-title">${book.trends.length} 条趋势，分在 ${book.boards.length} 个板块</h2>
      <div class="brush-grid">${brushes}</div>
      <p class="index-hint">点任意板块，进入该板块的第一条趋势</p>
    </div>
  </section>`;
}

function appendix(r: Report, book: TrendBook): string {
  const rows = r.evidence
    .map(
      (e) => `<tr><td>${e.id}</td><td><a href="${esc(e.url)}" target="_blank" rel="noreferrer">${esc(e.title)}</a></td>
      <td>${esc(r.sources.find((s) => s.id === e.sourceId)?.name ?? e.sourceId)}</td><td>${e.publishedAt}</td></tr>`,
    )
    .join("");
  return `
  <section class="appendix" id="appendix">
    <div class="inner">
      <p class="eyebrow">附录</p>
      <h2>口径与证据</h2>
      <p class="lede">主报告只放判断，出处和责任在这里。共 ${book.trends.length} 条趋势、${r.evidence.length} 篇证据。</p>
      <table class="tbl">
        <thead><tr><th>编号</th><th>标题</th><th>来源</th><th>发布</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="small">质量检查：${r.stats.errors} 个错误　${r.stats.warnings} 个警告　去重剔除 ${r.stats.duplicates} 条。</p>
    </div>
  </section>`;
}

function summarySection(s: SummaryModel): string {
  const missingRefs = (missing: string[]) => missing.length
    ? `<p class="small">${esc(missing.map((name) => `「${name}」`).join("、"))}缺少统计数据。</p>`
    : "";
  const blocks = s.blocks
    .map(
      (b) => `
      <div class="sum-block">
        <h3>${esc(b.title)}</h3>
        <p>${esc(b.claim)}</p>
        ${b.data ? `<p class="data-line">${esc(b.data)}</p>` : ""}
        ${missingRefs(b.missing)}
      </div>`,
    )
    .join("");

  return `
  <section class="summary" id="summary">
    <div class="inner">
      <p class="eyebrow">总述　${esc(s.season)}</p>
      <h2 class="thesis">${esc(s.thesis)}</h2>
      <div class="sum-grid">${blocks}</div>
      <div class="sum-counter">
        <h3>${esc(s.counter.title)}</h3>
        <p>${esc(s.counter.claim)}</p>
        ${s.counter.data ? `<p class="data-line">${esc(s.counter.data)}</p>` : ""}
        ${missingRefs(s.counter.missing)}
      </div>
      <p class="sum-close">${esc(s.close)}</p>
    </div>
  </section>`;
}

export function renderMagazine(
  book: TrendBook,
  r: Report,
  opts: { assetPrefix?: string; summary?: SummaryModel } = {},
): string {
  const prefix = opts.assetPrefix ?? "";
  const nav = book.trends
    .map((t) => `<a href="#${t.id}" data-id="${t.id}"><b>${esc(t.name)}</b><i>${esc(t.code)}</i></a>`)
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(book.periodLabel)}　${esc(book.seasonLabel)}趋势</title>
<style>
  :root { --ink:#1b1a17; --muted:#6f6a61; --paper:#faf8f4; --line:#e6e0d6; --accent:#8a1c2b; }
  * { box-sizing: border-box; }
  html { scroll-behavior: auto; }
  body { margin:0; background:var(--paper); color:var(--ink); font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif; -webkit-font-smoothing:antialiased; }
  img { display:block; max-width:100%; }
  a { color:inherit; }
  .inner { max-width:1240px; margin:0 auto; padding:0 56px; }
  .eyebrow { font-size:11px; letter-spacing:.24em; color:var(--accent); margin:0 0 14px; }

  /* 封面 */
  .cover { min-height:100dvh; display:flex; align-items:center; position:relative; overflow:hidden; background:#faf8f4; }
  .cover h1 { font-size:clamp(46px,7vw,92px); font-weight:600; letter-spacing:-.02em; margin:0; line-height:1.05; }
  .cover .season { font-family:"Songti SC","STSong","Noto Serif SC","SimSun",Georgia,serif; font-size:clamp(24px,3vw,38px); color:var(--accent); margin:16px 0 0; letter-spacing:.06em; }
  .cover .intro { max-width:560px; color:var(--muted); margin:30px 0 0; line-height:2; font-size:16px; }
  .cover .meta { display:flex; gap:34px; margin-top:64px; font-size:13px; color:var(--muted); letter-spacing:.1em; }
  .cover-wm { position:absolute; right:-2vw; bottom:-3vw; font-size:16vw; font-weight:700; color:rgba(27,26,23,.04); line-height:.8; user-select:none; }

  /* 总述 */
  .summary { background:#fff; padding:110px 0 96px; border-bottom:1px solid var(--line); }
  .summary .thesis { font-size:clamp(26px,3.2vw,42px); font-weight:600; line-height:1.55; margin:0; max-width:22em; letter-spacing:-.01em; }
  .sum-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:44px; margin-top:64px; }
  .sum-block h3 { font-size:17px; margin:0 0 12px; font-weight:600; }
  .sum-block p { font-size:14px; line-height:1.95; margin:0; color:#3a352e; }
  .data-line { margin-top:10px !important; font-size:12.5px !important; color:#7d766a !important; letter-spacing:.04em; }
  .sum-counter { margin-top:52px; padding-top:26px; border-top:1px dashed var(--line); }
  .sum-counter h3 { font-size:12px; letter-spacing:.2em; color:var(--muted); margin:0 0 10px; font-weight:500; }
  .sum-counter p { font-size:14px; line-height:1.95; margin:0; color:#3a352e; }
  .sum-close { margin:40px 0 0; font-size:19px; line-height:1.8; color:var(--ink); }

  /* 目录 */
  /* 目录：毛笔色块 + 竖排字 */
  .index { padding:120px 0 140px; background:#f6f2ea; }
  .index-title { font-size:clamp(26px,3vw,40px); font-weight:600; margin:0 0 76px; letter-spacing:-.01em; }
  .brush-grid { display:grid; grid-template-columns:repeat(3, 170px); justify-content:center; gap:26px 46px; align-items:start; }
  .brush { position:relative; display:block; height:420px; text-decoration:none; transition:transform .25s ease; }
  .brush:hover { transform:translateY(-6px); }
  .brush-bg { position:absolute; left:50%; top:0; width:132px; height:372px; margin-left:-66px;
              background:color-mix(in srgb, var(--accent) 68%, #fff);
              border-radius:46% 54% 43% 57% / 7% 9% 6% 8%; }
  .brush-name { position:absolute; top:46px; left:50%; transform:translateX(-50%);
                writing-mode:vertical-rl; font-family:"KaiTi","STKaiti","楷体",serif;
                font-size:42px; letter-spacing:.05em; line-height:1.12; color:#17130f; }
  .brush-en { position:absolute; bottom:0; left:50%; transform:translateX(-50%);
              font-size:10px; letter-spacing:.16em; color:rgba(0,0,0,.45); white-space:nowrap; }
  .brush-count { position:absolute; top:12px; left:calc(50% + 72px); font-size:10px; color:rgba(0,0,0,.4); }
  .index-hint { margin:78px 0 0; font-size:12px; color:var(--muted); letter-spacing:.06em; text-align:center; }

  /* 趋势页 */
  .trend { background:var(--paper); color:var(--ink); padding-bottom:96px; }
  .hero { position:relative; height:auto; overflow:hidden; background:color-mix(in srgb, var(--accent) 10%, #e8e4dc); }
  .hero img { display:block; width:100%; height:auto; }
  .hero-tag { position:absolute; right:20px; top:16px; display:flex; gap:16px; color:#fff; font-size:10px; letter-spacing:.18em; background:rgba(20,18,15,.38); padding:6px 11px; backdrop-filter:blur(3px); }
  .thead { padding:44px 0 0; }
  .thead h2 { font-size:clamp(36px,4.4vw,58px); font-weight:600; margin:0; letter-spacing:.01em; line-height:1.1; }
  .en { font-family:"Songti SC","STSong","Noto Serif SC","SimSun",Georgia,serif; color:var(--accent); font-size:17px; letter-spacing:.1em; margin:10px 0 0; }
  .tags { display:flex; gap:10px; margin:18px 0 0; }
  .tags span { font-size:11px; letter-spacing:.14em; color:var(--muted); border:1px solid var(--line); padding:3px 9px; border-radius:2px; }

  .grid { display:grid; grid-template-columns:1.05fr .95fr; gap:64px; margin-top:44px; }
  .reading { font-size:20px; line-height:1.95; margin:0 0 16px; color:var(--ink); }
  .evidence-line { font-size:12px; color:var(--muted); margin:0 0 26px; letter-spacing:.02em; }
  .intent { font-size:20px; line-height:1.85; margin:0 0 28px; }
  .form { margin:0; padding:0 0 0 22px; display:grid; gap:12px; }
  .form li { font-size:15px; line-height:1.9; color:#3a352e; }
  .form li::marker { color:var(--accent); font-size:12px; }
  .expr { margin:26px 0 0; font-size:14px; line-height:1.95; color:var(--muted); border-left:2px solid var(--accent); padding-left:16px; }

  .viz { display:grid; gap:26px; align-content:start; }  .viz-cap { font-size:10px; letter-spacing:.2em; color:var(--muted); margin:0; }
  .cloud { position:relative; width:100%; aspect-ratio:460/340; container-type:inline-size; }
  .cloud span { position:absolute; transform:translate(-50%, -50%); white-space:nowrap; line-height:1;
                color:color-mix(in srgb, var(--accent) 72%, var(--ink)); letter-spacing:.01em; }

  .momentum { border:1px solid var(--line); padding:22px 24px; background:#fff; }
  .mom-top { display:flex; align-items:baseline; gap:10px; }
  .arrow { font-size:44px; line-height:1; color:var(--accent); }
  .mom-num { font-size:34px; font-weight:300; letter-spacing:-.01em; }
  .momentum.down .arrow, .momentum.down .mom-num { color:#3a352e; }
  .mom-cap { margin:4px 0 16px; font-size:12px; color:var(--muted); letter-spacing:.1em; }
  .mom-bars { display:grid; gap:10px; }
  .mom-bars div { display:grid; grid-template-columns:76px 1fr 44px; gap:10px; align-items:center; font-size:11px; color:var(--muted); }
  .mom-bars i { display:block; height:9px; background:var(--accent); border-radius:1px; }
  .mom-bars b { font-weight:400; text-align:right; color:var(--ink); font-size:12px; }
  .mom-note { margin:14px 0 0; font-size:11px; color:rgba(27,26,23,.4); }


  .strip { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-top:52px; }
  .shot { margin:0; }
  .shot img { width:100%; height:250px; object-fit:contain; background:color-mix(in srgb, var(--accent) 8%, #ece8e0); }
  .shot figcaption { font-size:10px; color:var(--muted); margin-top:7px; letter-spacing:.08em; }

  .quotes { display:grid; grid-template-columns:repeat(3,1fr); gap:36px; margin-top:56px; border-top:1px solid var(--line); padding-top:32px; }
  .quote { margin:0; }
  .quote blockquote { margin:0; font-size:15px; line-height:1.95; }
  .quote figcaption { margin-top:14px; font-size:11px; letter-spacing:.08em; display:flex; gap:10px; }
  .quote figcaption a { text-decoration:none; border-bottom:1px solid rgba(27,26,23,.2); }
  .quote figcaption span { color:var(--muted); }

  /* 附录 */
  .appendix { background:#fff; padding:100px 0 120px; border-top:1px solid var(--line); }
  .appendix h2 { font-size:30px; margin:0 0 10px; font-weight:600; }
  .lede { color:var(--muted); margin:0 0 36px; font-size:14px; }
  .tbl { width:100%; border-collapse:collapse; font-size:12px; }
  .tbl th, .tbl td { text-align:left; padding:8px 10px; border-bottom:1px solid #eee9e0; }
  .tbl th { color:var(--muted); font-weight:500; white-space:nowrap; }
  .tbl a { text-decoration:none; border-bottom:1px solid #ddd6ca; }
  .small { font-size:12px; color:var(--muted); margin-top:18px; }

  /* 导航与动效 */
  .rail { position:fixed; left:22px; top:50%; transform:translateY(-50%); display:grid; gap:9px; z-index:30; }
  .rail a { text-decoration:none; font-size:10px; letter-spacing:.06em; color:rgba(27,26,23,.28); display:grid; }
  .rail a b { font-weight:400; }
  .rail a i { font-style:normal; font-size:9px; opacity:.6; }
  .rail a.on { color:var(--accent); }
  .progress { position:fixed; left:0; top:0; height:2px; background:var(--accent); width:0; z-index:40; }
  .toggle { position:fixed; right:22px; bottom:22px; z-index:40; border:1px solid var(--line); background:#fff; color:var(--muted);
            font-size:11px; letter-spacing:.1em; padding:8px 12px; cursor:pointer; }
  .pager { display:flex; justify-content:space-between; margin-top:44px; padding-top:22px; border-top:1px solid var(--line); font-size:13px; }
  .pager a { color:var(--ink); text-decoration:none; border-bottom:1px solid rgba(27,26,23,.25); padding-bottom:2px; }
  .pager a:hover { color:var(--accent); border-color:var(--accent); }
  @media (max-width:1100px) { .rail { display:none; } }
  @media (max-width:900px) {
    .inner { padding:0 24px; }
    .brush-grid { grid-template-columns:repeat(2, 140px); gap:20px 30px; }
    .brush { height:350px; }
    .brush-bg { width:110px; margin-left:-55px; height:310px; }
    .brush-name { font-size:34px; top:38px; }
    .grid { grid-template-columns:1fr; gap:36px; }
    .strip, .quotes { grid-template-columns:1fr; }
    .hero-tag { left:24px; }
  }
  @media print {
    .rail, .toggle, .progress { display:none; }
    .cover, .summary, .index, .trend, .appendix { page-break-after:always; page-break-inside:avoid; min-height:0; }
    .cover { min-height:auto; padding:60px 0; }
    .hero { height:auto; max-height:60vh; }
    * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  }
</style>
</head>
<body>
  <div class="progress" id="progress"></div>
  <nav class="rail">${nav}</nav>

  <header class="cover">
    <div class="inner">
      <p class="eyebrow">${esc(book.periodLabel)}　趋势分析</p>
      <h1>${esc(book.seasonLabel)}女装趋势</h1>
      <p class="season">${esc(book.seasonCode)}</p>
      <p class="intro">${esc(book.intro)}</p>
      <div class="meta"><span>${book.trends.length} 条趋势</span><span>${book.boards.length} 个板块</span><span>${r.evidence.length} 篇证据</span></div>
    </div>
    <span class="cover-wm">${esc(book.seasonCode)}</span>
  </header>

  ${opts.summary ? summarySection(opts.summary) : ""}

  ${indexPage(book)}
  ${book.trends
    .map((t, i) =>
      trendPage(t, i, book.boards, book.trends.length, prefix, book.trends[i - 1]?.id, book.trends[i + 1]?.id),
    )
    .join("")}
  ${appendix(r, book)}

  <button class="toggle" id="toggle">关闭缓动</button>
  <script>
    (function () {
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var damp = !reduce;
      var target = window.scrollY, current = target, raf = null;

      function clamp(v) { return Math.max(0, Math.min(v, document.body.scrollHeight - innerHeight)); }
      function loop() {
        current += (target - current) * 0.11;
        if (Math.abs(target - current) < 0.4) { current = target; raf = null; }
        window.scrollTo(0, current);
        if (raf) raf = requestAnimationFrame(loop);
      }
      function kick() { if (!raf) raf = requestAnimationFrame(loop); }

      window.addEventListener('wheel', function (e) {
        if (!damp) return;
        if (e.ctrlKey) return;
        e.preventDefault();
        target = clamp(target + e.deltaY * (e.deltaMode === 1 ? 16 : 1));
        kick();
      }, { passive: false });

      window.addEventListener('scroll', function () {
        if (raf) return;
        target = current = window.scrollY;
        var h = document.body.scrollHeight - innerHeight;
        document.getElementById('progress').style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
        var links = document.querySelectorAll('.rail a');
        var best = null, bestD = 1e9;
        links.forEach(function (a) {
          var el = document.getElementById(a.dataset.id);
          if (!el) return;
          var d = Math.abs(el.getBoundingClientRect().top - 120);
          if (d < bestD) { bestD = d; best = a; }
        });
        links.forEach(function (a) { a.classList.toggle('on', a === best); });
      }, { passive: true });

      document.querySelectorAll('a[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function (ev) {
          var el = document.querySelector(a.getAttribute('href'));
          if (!el) return;
          ev.preventDefault();
          target = clamp(el.getBoundingClientRect().top + window.scrollY - 20);
          kick();
        });
      });

      var btn = document.getElementById('toggle');
      btn.addEventListener('click', function () {
        damp = !damp;
        btn.textContent = damp ? '关闭缓动' : '开启缓动';
      });
      if (!damp) btn.textContent = '开启缓动';
    })();
  </script>
</body>
</html>`;
}
