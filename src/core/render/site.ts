/** 报告入口页：把 demo / curated / auto 三种输出汇总成一张目录。 */
import type { SiteData, SiteEntry } from "../types.ts";

export type { SiteData, SiteEntry };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const ORDER: Record<string, number> = { auto: 0, curated: 1, demo: 2 };

export function renderSite(data: SiteData): string {
  const entries = [...data.entries].sort(
    (a, b) => (ORDER[a.dir] ?? 9) - (ORDER[b.dir] ?? 9),
  );

  const cards = entries
    .map(
      (e) => `
      <div class="card">
        <p class="k">${esc(e.kicker)}</p>
        <h2><a href="${esc(e.dir)}/deck.html">${esc(e.title)}</a></h2>
        <p class="d">${esc(e.desc)}</p>
        <p class="s">${esc(e.stats)}</p>
        <p class="links">
          <a class="go" href="${esc(e.dir)}/deck.html">打开报告 →</a>
          ${e.files.includes("trends.md") ? `<a href="${esc(e.dir)}/trends.md">Markdown</a>` : ""}
          ${e.files.includes("report.json") ? `<a href="${esc(e.dir)}/report.json">JSON</a>` : ""}
        </p>
        <p class="t">${esc(e.at)}</p>
      </div>`,
    )
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>趋势报告入口</title>
<style>
  :root { --ink:#1b1a17; --muted:#6f6a61; --line:#e6e0d6; --accent:#8a1c2b; }
  * { box-sizing:border-box; }
  body { margin:0; background:#faf8f4; color:var(--ink); font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif; }
  .wrap { max-width:1100px; margin:0 auto; padding:96px 40px 120px; }
  .eyebrow { font-size:11px; letter-spacing:.28em; color:var(--accent); margin:0 0 18px; }
  h1 { font-size:clamp(36px,5vw,60px); margin:0; letter-spacing:-.02em; font-weight:600; }
  .sub { color:var(--muted); margin:16px 0 56px; font-size:15px; line-height:1.9; max-width:620px; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
  .card { display:block; background:#fff; border:1px solid var(--line); padding:28px 26px 22px; transition:border-color .2s, transform .2s; }
  .card:hover { border-color:var(--accent); transform:translateY(-2px); }
  .k { font-size:10px; letter-spacing:.22em; color:var(--accent); margin:0 0 14px; }
  .card h2 { font-size:24px; margin:0 0 12px; font-weight:600; }
  .card h2 a { color:inherit; text-decoration:none; }
  .d { color:var(--muted); font-size:13px; line-height:1.8; margin:0 0 18px; min-height:46px; }
  .s { font-size:12px; color:var(--ink); margin:0 0 18px; }
  .links { display:flex; gap:14px; align-items:center; font-size:12px; margin:0; }
  .links a { color:var(--muted); text-decoration:none; border-bottom:1px solid #d9d2c6; }
  .links a.go { color:var(--accent); border-bottom-color:var(--accent); }
  .t { font-size:11px; color:#a39b8e; margin:16px 0 0; }
  .foot { margin-top:56px; font-size:12px; color:var(--muted); line-height:2; border-top:1px solid var(--line); padding-top:20px; }
  code { background:#f1ede6; padding:1px 5px; border-radius:3px; font-size:11px; }
  @media (max-width:900px){ .grid{grid-template-columns:1fr;} }
</style>
</head>
<body>
  <div class="wrap">
    <p class="eyebrow">TREND LAB</p>
    <h1>趋势报告入口</h1>
    <p class="sub">三种模式，共用一套证据与渲染。自动模式看风向，精细模式做论证，示例数据只用于验证链路。</p>
    <div class="grid">${cards}</div>
    <p class="foot">
      每个目录里有：<code>deck.html</code> 图文报告　<code>trends.md</code> 文字版　<code>report.md</code> 命题版　<code>report.json</code> 结构化数据<br />
      重新生成：<code>pnpm ingest</code>　<code>pnpm real</code>　<code>pnpm demo</code>
    </p>
  </div>
</body>
</html>`;
}
