"""Parse foreign.md / local.md into evidence JSON (auto-coded, flagged for review)."""
import json, re, sys

SIGNALS = {
    "sheer": r"(薄纱|欧根纱|网眼|透视|see[- ]?through|sheer|organza|tulle|mesh|gauze|voile)",
    "check": r"(格纹|千鸟格|威尔士|苏格兰格|tartan|plaid|checker|check\b|houndstooth)",
    "tailoring": r"(西装|剪裁|定制|tailoring|tailored|suiting|suits?\b|blazer)",
}

OUTLET_META = {
    "Vogue": ("conde-nast", "en", "us", "media", 2),
    "Vogue UK": ("conde-nast", "en", "uk", "media", 2),
    "Vogue China": ("conde-nast", "zh", "cn", "media", 2),
    "Vogue Taiwan": ("conde-nast", "zh", "tw", "media", 2),
    "WWD": ("wwd", "en", "us", "media", 2),
    "WWD / Sourcing Journal": ("wwd", "en", "us", "trade", 2),
    "Elle Singapore": ("lagardere", "en", "sg", "media", 2),
    "Harper's Bazaar": ("hearst", "en", "us", "media", 2),
    "Who What Wear": ("future-plc", "en", "us", "media", 2),
    "The Zoe Report": ("bustle-group", "en", "us", "media", 2),
    "Fashion Week Daily": ("fwd", "en", "us", "media", 2),
    "Marie Claire UK": ("future-plc", "en", "uk", "media", 2),
    "RUSSH": ("russh", "en", "au", "media", 2),
    "Numéro": ("numero", "en", "fr", "media", 2),
    "L'Officiel England": ("officiel", "en", "uk", "media", 2),
    "A Shaded View on Fashion": ("asvof", "en", "fr", "media", 3),
    "WGSN / Coloro": ("wgsn", "en", "global", "forecast", 1),
    "Première Vision": ("premiere-vision", "en", "global", "trade", 1),
    "FashionUnited": ("fashionunited", "en", "global", "media", 2),
    "界面新闻": ("jiemian", "zh", "cn", "media", 2),
    "新华财经": ("xinhua", "zh", "cn", "media", 2),
    "艺术与设计": ("artdesign", "zh", "cn", "media", 3),
    "LADYMAX": ("ladymax", "zh", "cn", "media", 3),
    "网易": ("netease", "zh", "cn", "media", 3),
    "CBNData": ("cbndata", "zh", "cn", "commerce", 3),
    "艾媒咨询": ("iimedia", "zh", "cn", "commerce", 3),
    "搜狐": ("sohu", "zh", "cn", "media", 3),
}

SLUG = {
    "Vogue": "vogue", "Vogue UK": "vogue-uk", "Vogue China": "vogue-cn",
    "Vogue Taiwan": "vogue-tw", "WWD": "wwd", "WWD / Sourcing Journal": "wwd-sj",
    "Elle Singapore": "elle-sg", "Harper's Bazaar": "bazaar",
    "Who What Wear": "whowhatwear", "The Zoe Report": "zoe-report",
    "Fashion Week Daily": "fwd", "Marie Claire UK": "marie-claire-uk",
    "RUSSH": "russh", "Numéro": "numero", "L'Officiel England": "officiel-uk",
    "A Shaded View on Fashion": "asvof", "WGSN / Coloro": "wgsn",
    "Première Vision": "premiere-vision", "FashionUnited": "fashionunited",
    "界面新闻": "jiemian", "新华财经": "xinhua", "艺术与设计": "artdesign",
    "LADYMAX": "ladymax", "网易": "netease", "CBNData": "cbndata",
    "艾媒咨询": "iimedia", "搜狐": "sohu",
}

WINDOW_OF = {"FW26": "A", "SS27": "B"}

# 人工复核后的覆盖：关键词法把「趋势陈述」和「单件衣服描述」混在一起，
# 下面这些条目人工确认属于实质趋势讨论，但命中次数只有 1。
MANUAL_TRUE = {
    "F30": {"sheer"},
    "F31": {"sheer"},
    "L01": {"sheer"},
    "L02": {"sheer"},
}


def parse(path):
    txt = open(path, encoding="utf-8").read()
    parts = re.split(r'<a id="([fl]\d+)"></a>', txt)
    out = []
    for i in range(1, len(parts), 2):
        code, body = parts[i], parts[i + 1]
        m = re.search(r"### [FL]\d+ · (.+)", body)
        title = m.group(1).strip() if m else ""
        row = re.search(r"\| ([^|]+?) \| ([^|]+?) \| ([^|]+?) \| ([^|]+?) \| ([\d,]+) 字符 \|", body)
        outlet = row.group(1).strip() if row else ""
        typ = row.group(2).strip() if row else ""
        win = row.group(3).strip() if row else ""
        date = row.group(4).strip() if row else ""
        u = re.search(r"原文：<([^>]+)>", body)
        url = u.group(1).strip() if u else ""
        text = body.split("\n---\n", 1)[1] if "\n---\n" in body else ""
        out.append({
            "code": code.upper(), "title": title, "outlet": outlet, "type": typ,
            "season": win, "date": date, "url": url, "text": text,
        })
    return out


def snippet(text, pat):
    """取匹配点所在的整句，便于人工复核。"""
    m = re.search(pat, text, re.I)
    if not m:
        return ""
    left = max(text.rfind(". ", 0, m.start()), text.rfind("。", 0, m.start()),
               text.rfind("\n", 0, m.start()), 0)
    left = left + 1 if left > 0 else 0
    rights = [i for i in (text.find(". ", m.end()), text.find("。", m.end()),
                          text.find("\n", m.end())) if i != -1]
    right = min(rights) + 1 if rights else len(text)
    sent = re.sub(r"\s+", " ", text[left:right]).strip()
    if len(sent) > 220:
        sent = sent[:217] + "…"
    return sent


def main():
    rows = parse(r"D:\chajian\foreign.md") + parse(r"D:\chajian\local.md")
    sources, evidence, digest = {}, [], []

    for r in rows:
        meta = OUTLET_META.get(r["outlet"])
        if not meta:
            print("UNKNOWN OUTLET:", repr(r["outlet"]), file=sys.stderr)
            continue
        group, lang, region, typ, tier = meta
        sid = "src-" + SLUG[r["outlet"]]
        sources[sid] = {
            "id": sid, "name": r["outlet"], "domain": "corpus.example",
            "publisherGroup": group, "language": lang, "region": region,
            "type": typ, "tier": tier, "paywall": False, "crawlable": True,
        }

        counts = {}
        for key, pat in SIGNALS.items():
            counts[key] = len(re.findall(pat, r["text"], re.I))

        codings, review = {}, {}
        for key, c in counts.items():
            if c >= 2:
                codings[key] = True
            elif c == 0:
                codings[key] = False
            else:
                codings[key] = False
                review[key] = snippet(r["text"], SIGNALS[key])
        for key in MANUAL_TRUE.get(r["code"], set()):
            codings[key] = True
            review.pop(key, None)

        date = r["date"] if re.match(r"^\d{4}-\d{2}-\d{2}$", r["date"]) else "2026-11-01"
        excerpt = snippet(r["text"], "|".join(SIGNALS.values()))
        if len(excerpt) < 20:
            excerpt = re.sub(r"\s+", " ", r["text"])[:160].strip()

        evidence.append({
            "id": r["code"], "sourceId": sid, "url": r["url"], "title": r["title"],
            "publishedAt": date, "dateEstimated": date != r["date"], "accessedAt": "2026-11-01",
            "season": r["season"] if r["season"] in ("FW26", "SS27") else "other",
            "window": WINDOW_OF.get(r["season"], "X"),
            "brand": "", "category": "",
            "excerpt": excerpt,
            "originality": "original", "isSponsored": False,
            "codings": codings,
        })
        digest.append((r["code"], r["outlet"], r["season"], r["date"],
                       counts, review, r["title"][:40]))

    json.dump({"sources": list(sources.values())},
              open(r"D:\chajian\data\sources.real.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    notes = ("数据为 foreign.md + local.md 的 50 篇全文（35 英文 / 15 中文），"
             "窗口按文章主题季归入，零售/数据稿归 X 不参与命题。"
             "编码方式：先按编码规则做关键词辅助标注（≥2 处记 true，仅 1 处进入人工复核），"
             "再对全部单次命中逐条人工判定——属于「关键词辅助的内容编码」，不等于逐篇精读编码。")
    json.dump({"dataset": "q4-2026-corpus-v1", "synthetic": False, "notes": notes, "evidence": evidence},
              open(r"D:\chajian\data\evidence.real.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)

    lines = []
    for code, outlet, season, date, counts, review, title in digest:
        lines.append(f"{code} | {outlet} | {season} | {date} | "
                     f"sheer={counts['sheer']} check={counts['check']} tail={counts['tailoring']} | {title}")
        for key, snip in review.items():
            lines.append(f"    ?{key}: {snip[:120]}")
    open(r"D:\chajian\_tools\digest.txt", "w", encoding="utf-8").write("\n".join(lines))
    print(f"parsed {len(evidence)} articles, {len(sources)} sources")


if __name__ == "__main__":
    main()
