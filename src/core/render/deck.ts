/** 趋势报告版式：一屏一条趋势，数字当主角，证据收进抽屉。 */
import type { DeckModel, DeckPage } from "../present.ts";
import { dotGlyphs } from "../present.ts";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pageHtml(p: DeckPage, seasonCode: string): string {
  const dots = dotGlyphs(p.dots).join("");
  const bars = [
    { label: "2026 秋冬", value: p.shareA, n: p.nA, k: p.kA, kind: "a" },
    { label: "2027 春夏", value: p.shareB, n: p.nB, k: p.kB, kind: "b" },
  ]
    .map(
      (b) => `
        <div class="bar-row">
          <span class="bar-label">${b.label}</span>
          <span class="bar-track"><i class="${b.kind}" style="width:${b.value}%"></i></span>
          <span class="bar-val">${b.value}%</span>
        </div>`,
    )
    .join("");

  const evidenceItems = p.support
    .slice(0, 12)
    .map(
      (e) =>
        `<li><a href="${esc(e.url)}" target="_blank" rel="noreferrer">${esc(e.title)}</a><span>${esc(e.source)}　${e.date}</span></li>`,
    )
    .join("");

  return `
  <section class="page" id="p-${p.no}" style="--paper:${p.palette.paper};--accent:${p.palette.accent};--ink:${p.palette.ink}">
    <span class="wm" aria-hidden="true">${esc(seasonCode)}</span>
    <div class="wrap">
      <p class="eyebrow">NO.${p.no}</p>
      <div class="head">
        <h2>${esc(p.title)}</h2>
        ${p.kwA || p.kwB ? `<p class="sub">${esc(p.kwA)}${p.kwA && p.kwB ? '<span class="sep">/</span>' : ""}${esc(p.kwB)}</p>` : ""}
      </div>
      <div class="cols">
        <div class="copy">
          ${p.lines.map((l, i) => `<p class="${i === p.lines.length - 1 ? "dim" : ""}">${esc(l)}</p>`).join("")}
        </div>
        <div class="panel">
          <div class="figure">
            <span class="fig-num">${p.shareB}</span><span class="fig-unit">%</span>
          </div>
          <p class="fig-cap">2027 春夏　${p.nB} 篇中 ${p.kB} 篇</p>
          <div class="bars">${bars}</div>
          <div class="delta ${p.delta.dir}">${esc(p.delta.text)}</div>
        </div>
      </div>
      <footer class="foot">
        <span class="conf" title="${esc(p.confHint)}">
          <b class="dots">${dots}</b> 置信度 ${p.confLabel}
        </span>
        <details class="ev">
          <summary>证据 ${p.evidenceCount} 篇　来源 ${p.sourceCount} 家</summary>
          <ul>${evidenceItems}</ul>
          <p class="ev-foot">${p.counterCount > 0 ? `另列反证 ${p.counterCount} 条` : "未发现结构性反证"}　${p.caveats.join("　")}</p>
        </details>
      </footer>
    </div>
  </section>`;
}

function appendixHtml(m: DeckModel): string {
  const claims = m.appendix.claims
    .map(
      (c) => `
      <tr>
        <td>${esc(c.id)}</td>
        <td>${esc(c.question)}</td>
        <td>${esc(c.windowA.label)}</td>
        <td>${esc(c.windowB.label)}</td>
        <td>${c.minN}</td>
        <td>${esc(c.codingRule)}</td>
      </tr>`,
    )
    .join("");

  const srcName = new Map(m.appendix.sources.map((s) => [s.id, s.name]));
  const rows = m.appendix.evidence
    .map(
      (e) => `
      <tr>
        <td>${esc(e.id)}</td>
        <td><a href="${esc(e.url)}" target="_blank" rel="noreferrer">${esc(e.title)}</a></td>
        <td>${esc(srcName.get(e.sourceId) ?? e.sourceId)}</td>
        <td>${e.publishedAt}</td>
        <td>${esc(e.window)}</td>
        <td>${esc(e.season)}</td>
      </tr>`,
    )
    .join("");

  return `
  <section class="appendix" id="appendix">
    <div class="wrap">
      <h2>附录</h2>
      <p class="lede">主报告只放结论，口径、证据与审计放在这里，方便复核。</p>

      <h3>口径</h3>
      <table class="tbl">
        <thead><tr><th>编号</th><th>命题</th><th>对比窗口</th><th>参照窗口</th><th>最小样本</th><th>编码规则</th></tr></thead>
        <tbody>${claims}</tbody>
      </table>

      <h3>证据台账　共 ${m.appendix.evidence.length} 篇</h3>
      <table class="tbl">
        <thead><tr><th>编号</th><th>标题</th><th>来源</th><th>发布</th><th>窗口</th><th>季节</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <h3>质量检查</h3>
      <p>${m.audit.errors} 个错误　${m.audit.warnings} 个警告　去重剔除 ${m.totals.duplicates} 条</p>
      ${m.appendix.notes ? `<p class="small">数据说明：${esc(m.appendix.notes)}</p>` : ""}
    </div>
  </section>`;
}

export function renderDeck(m: DeckModel): string {
  const nav = m.pages
    .map((p) => `<a href="#p-${p.no}" data-target="p-${p.no}"><span>${p.no}</span></a>`)
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(m.periodLabel)}　${esc(m.coverTitle)}</title>
<style>
  :root {
    --ink: #1b1a17;
    --muted: #6f6a61;
    --paper: #faf8f4;
    --line: #e6e0d6;
    --accent: #8a1c2b;
    --serif: "Songti SC", "STSong", "Source Han Serif SC", Georgia, serif;
    --sans: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
  a { color: inherit; }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 0 56px; }

  /* 封面 */
  .cover { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; position: relative; overflow: hidden; background: #faf8f4; }
  .cover .wrap { position: relative; z-index: 2; }
  .cover-top { font-size: 13px; letter-spacing: .28em; color: var(--muted); margin-bottom: 56px; }
  .cover h1 { font-size: clamp(52px, 8vw, 104px); font-weight: 600; letter-spacing: -.02em; margin: 0; line-height: 1.04; }
  .cover-season { font-family: var(--serif); font-size: clamp(28px, 3.4vw, 44px); color: var(--accent); margin: 18px 0 0; letter-spacing: .08em; }
  .cover-sub { font-size: 16px; color: var(--muted); margin: 28px 0 0; max-width: 520px; line-height: 1.9; }
  .cover-meta { margin-top: 72px; font-size: 13px; color: var(--muted); letter-spacing: .12em; display: flex; gap: 28px; }
  .cover-note { margin-top: 18px; font-size: 12px; color: var(--accent); letter-spacing: .16em; }
  .cover-wm { position: absolute; right: -2vw; bottom: -2vw; font-size: 15vw; font-weight: 700; letter-spacing: -.04em; color: rgba(27,26,23,.04); line-height: .8; user-select: none; }

  /* 趋势页 */
  .page { position: relative; overflow: hidden; padding: 108px 0 72px; background: var(--paper); color: var(--ink); min-height: 100vh; display: flex; align-items: center; }
  .page .wrap { position: relative; width: 100%; }
  .page .wm { position: absolute; right: -2vw; bottom: -3vw; font-size: 15vw; font-weight: 700; letter-spacing: -.03em; color: var(--accent); opacity: .045; line-height: .8; user-select: none; }
  .eyebrow { font-size: 11px; letter-spacing: .12em; color: var(--accent); margin: 0 0 20px; font-variant-numeric: tabular-nums; }
  .head h2 { font-size: clamp(40px, 5vw, 64px); font-weight: 600; margin: 0; letter-spacing: .01em; line-height: 1.1; }
  .sub { font-size: 17px; color: var(--muted); margin: 14px 0 0; letter-spacing: .04em; }
  .sub .sep { margin: 0 10px; color: var(--accent); opacity: .7; }
  .cols { display: grid; grid-template-columns: 1.15fr .85fr; gap: 72px; margin-top: 52px; align-items: start; }
  .copy p { font-size: 17px; line-height: 2.05; margin: 0 0 18px; max-width: 34em; }
  .copy .dim { color: var(--muted); }
  .panel { border-left: 1px solid rgba(27,26,23,.1); padding-left: 48px; }
  .figure { display: flex; align-items: baseline; gap: 6px; }
  .fig-num { font-size: 104px; font-weight: 300; letter-spacing: -.03em; line-height: .9; font-variant-numeric: tabular-nums; }
  .fig-unit { font-size: 30px; font-weight: 300; color: var(--accent); }
  .fig-cap { font-size: 13px; color: var(--muted); margin: 12px 0 0; letter-spacing: .06em; }
  .bars { margin-top: 36px; display: grid; gap: 16px; }
  .bar-row { display: grid; grid-template-columns: 84px 1fr 52px; gap: 14px; align-items: center; }
  .bar-label { font-size: 12px; color: var(--muted); letter-spacing: .04em; }
  .bar-track { height: 6px; background: rgba(27,26,23,.08); border-radius: 3px; overflow: hidden; }
  .bar-track i { display: block; height: 100%; border-radius: 3px; }
  .bar-track i.a { background: rgba(27,26,23,.28); }
  .bar-track i.b { background: var(--accent); }
  .bar-val { font-size: 13px; text-align: right; font-variant-numeric: tabular-nums; }
  .delta { margin-top: 22px; display: inline-block; font-size: 13px; letter-spacing: .08em; padding: 5px 12px; border-radius: 2px; }
  .delta.up { background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent); }
  .delta.down { background: rgba(27,26,23,.07); color: var(--ink); }
  .delta.flat { background: rgba(27,26,23,.05); color: var(--muted); }
  .foot { margin-top: 64px; display: flex; align-items: flex-start; justify-content: space-between; gap: 32px; border-top: 1px solid rgba(27,26,23,.1); padding-top: 22px; font-size: 12px; color: var(--muted); }
  .dots { letter-spacing: 3px; margin-right: 6px; color: var(--accent); }
  .ev summary { cursor: pointer; list-style: none; letter-spacing: .06em; }
  .ev summary::-webkit-details-marker { display: none; }
  .ev summary::after { content: "　展开"; font-size: 11px; letter-spacing: .1em; opacity: .7; }
  .ev[open] summary::after { content: "　收起"; }
  .ev ul { margin: 16px 0 0; padding: 0; list-style: none; display: grid; gap: 10px; max-width: 620px; }
  .ev li { display: grid; gap: 2px; font-size: 12px; line-height: 1.6; }
  .ev li a { text-decoration: none; border-bottom: 1px solid rgba(27,26,23,.18); }
  .ev li span { color: rgba(27,26,23,.45); font-size: 11px; letter-spacing: .04em; }
  .ev-foot { margin-top: 14px; font-size: 11px; color: rgba(27,26,23,.45); }

  /* 附录 */
  .appendix { background: #fff; padding: 96px 0 120px; border-top: 1px solid var(--line); }
  .appendix h2 { font-size: 30px; font-weight: 600; margin: 0 0 8px; }
  .appendix .lede { color: var(--muted); margin: 0 0 40px; font-size: 14px; }
  .appendix h3 { font-size: 15px; font-weight: 600; margin: 44px 0 12px; letter-spacing: .04em; }
  .tbl { width: 100%; border-collapse: collapse; font-size: 12px; }
  .tbl th, .tbl td { text-align: left; padding: 9px 10px; border-bottom: 1px solid #eee9e0; vertical-align: top; line-height: 1.7; }
  .tbl th { color: var(--muted); font-weight: 500; white-space: nowrap; }
  .tbl a { text-decoration: none; border-bottom: 1px solid #ddd6ca; }
  .small { font-size: 12px; color: var(--muted); line-height: 1.9; margin-top: 18px; }

  /* 侧边索引 */
  .rail { position: fixed; left: 26px; top: 50%; transform: translateY(-50%); display: grid; gap: 14px; z-index: 20; }
  .rail a { text-decoration: none; font-size: 11px; letter-spacing: .08em; color: rgba(27,26,23,.25); font-variant-numeric: tabular-nums; transition: color .2s; }
  .rail a.active { color: var(--accent); }
  .rail a::before { content: ""; display: block; width: 14px; height: 1px; background: currentColor; margin-bottom: 6px; }
  @media (max-width: 1180px) { .rail { display: none; } }
  @media (max-width: 900px) {
    .wrap { padding: 0 26px; }
    .cols { grid-template-columns: 1fr; gap: 44px; }
    .panel { border-left: 0; padding-left: 0; border-top: 1px solid rgba(27,26,23,.1); padding-top: 32px; }
    .no { font-size: 84px; top: -56px; }
    .foot { flex-direction: column; gap: 18px; }
  }
  @media print { .rail { display: none; } .page, .cover { min-height: auto; page-break-after: always; } }
</style>
</head>
<body>
  <nav class="rail">${nav}</nav>

  <header class="cover">
    <div class="wrap">
      <p class="cover-top">${esc(m.periodLabel)}　趋势分析</p>
      <h1>${esc(m.coverTitle)}</h1>
      <p class="cover-season">${esc(m.seasonLabel)}</p>
      <p class="cover-sub">${esc(m.coverSub)}</p>
      <div class="cover-meta">
        <span>样本 ${m.totals.evidence} 篇</span>
        <span>来源 ${m.totals.sources} 家</span>
        <span>结论 ${m.totals.findings} 条</span>
      </div>
      ${m.synthetic ? '<p class="cover-note">示例数据　仅用于验证流程</p>' : ""}
    </div>
    <span class="cover-wm" aria-hidden="true">${esc(m.seasonCode)}</span>
  </header>

  ${m.pages.map((p) => pageHtml(p, m.seasonCode)).join("")}

  ${appendixHtml(m)}

  <script>
    (function () {
      const links = Array.from(document.querySelectorAll('.rail a'));
      const pages = links.map((a) => document.getElementById(a.dataset.target)).filter(Boolean);
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (!en.isIntersecting) return;
            links.forEach((a) => a.classList.toggle('active', a.dataset.target === en.target.id));
          });
        },
        { rootMargin: '-45% 0px -45% 0px' },
      );
      pages.forEach((p) => io.observe(p));
    })();
  </script>
</body>
</html>`;
}
