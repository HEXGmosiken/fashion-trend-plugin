"""Build data/trends.json from trends.source.json + corpus + images + findings."""
import json, re, sys, os
sys.path.insert(0, r"D:\chajian\_tools")
from ingest import parse
from lexicon import TERMS

ROOT = r"D:\chajian"
src = json.load(open(os.path.join(ROOT, "data/trends.source.json"), encoding="utf-8"))
tax = json.load(open(os.path.join(ROOT, "data/taxonomy.json"), encoding="utf-8"))
imgs = json.load(open(os.path.join(ROOT, "data/images.manifest.json"), encoding="utf-8"))
report = json.load(open(os.path.join(ROOT, "reports-real/report.json"), encoding="utf-8"))

rows = parse(os.path.join(ROOT, "foreign.md")) + parse(os.path.join(ROOT, "local.md"))
text = {r["code"]: r["text"] for r in rows}
meta = {r["code"]: r for r in rows}
sources = {s["id"]: s for s in report["sources"]}
ev_src = {e["id"]: e["sourceId"] for e in report["evidence"]}
findings = {f["claimId"]: f for f in report.get("findings", [])}


BAD_END = re.compile(r"(Mrs|Mr|Ms|Dr|St|No|vs|etc|Inc|Ltd)\.$")


def sentences(t):
    parts = re.split(r"(?<=[。！？.!?])\s*|\n+", t)
    out = []
    for p in parts:
        s = re.sub(r"\s+", " ", p).strip()
        if len(s) <= 20 or s.startswith("#") or BAD_END.search(s) or s.endswith("，"):
            continue
        out.append(s)
    return out


def pick_quote(code, pat, keywords):
    t = text.get(code, "")
    sents = sentences(t)
    best, best_score = "", -1
    for s in sents:
        m = 1 if re.search(pat, s, re.I) else 0
        hits = sum(1 for k in keywords if k in s)
        if not (m or hits):
            continue
        score = hits * 2 + m - (1 if len(s) > 190 else 0)
        if score > best_score or (score == best_score and len(s) < len(best)):
            best, best_score = s, score
    if best:
        return best[:190], True
    return (sents[0][:190] if sents else ""), False


problems = []
out_trends = []

for trend in src["trends"]:
    quotes = []
    for code in trend["quotes"]:
        q, ok = pick_quote(code, trend["match"], trend["keywords"])
        if not q:
            problems.append(f"{trend['id']}: 没有可引用正文 {code}")
            continue
        if not ok:
            problems.append(f"{trend['id']}: {code} 没有命中关键词，已退化为首句")
        sid = ev_src.get(code, "")
        s = sources.get(sid, {})
        quotes.append({
            "ev": code,
            "source": s.get("name", sid),
            "url": meta[code]["url"],
            "date": meta[code]["date"],
            "text": q,
        })

    images = []
    for code in trend["images"]:
        rec = imgs.get(code, {})
        if rec.get("status") in ("ok", "cached"):
            images.append({
                "src": f"../assets/img/{code}.jpg",
                "w": rec.get("w"), "h": rec.get("h"),
                "ev": code, "source": sources.get(ev_src.get(code, ""), {}).get("name", ""),
            })
    if len(images) < 3:
        problems.append(f"{trend['id']}: 只有 {len(images)} 张图")

    keywords = []
    seen = set()
    RX = {zh: rx for zh, rx, _b in TERMS}
    matched = [t for t in text.values() if re.search(trend["match"], t, re.I)]
    for kw in trend["keywords"]:
        pat = RX.get(kw, re.escape(kw))
        n = int((sum(1 for t in matched if re.search(pat, t, re.I)) or 1) * 1.6)
        if kw not in seen:
            seen.add(kw)
            keywords.append({"t": kw, "n": n})
    # 用同板块词补足，做法是「与这条趋势共现的篇数」
    co = []
    for zh, rx, _board in TERMS:
        if zh in seen:
            continue
        n_co = sum(1 for t in matched if re.search(rx, t, re.I))
        if n_co >= 1:
            co.append((zh, n_co, n_co))
    co.sort(key=lambda x: (-x[1], -x[2]))
    for zh, _n_co, n_all in co:
        if len(keywords) >= 40:
            break
        if zh in seen:
            continue
        seen.add(zh)
        keywords.append({"t": zh, "n": n_all})
    keywords.sort(key=lambda x: -x["n"])

    claim = None
    cid = trend.get("claimId")
    if cid and cid in findings:
        f = findings[cid]
        claim = {
            "id": cid,
            "shareA": round(f["comparison"]["a"]["share"] * 100),
            "shareB": round(f["comparison"]["b"]["share"] * 100),
            "nA": f["comparison"]["a"]["n"], "nB": f["comparison"]["b"]["n"],
            "kA": f["comparison"]["a"]["k"], "kB": f["comparison"]["b"]["k"],
            "confidence": f["confidence"],
        }

    out_trends.append({
        "id": trend["id"], "board": trend["board"], "name": trend["name"],
        "code": trend["code"], "tags": trend["tags"],
        "intent": trend["intent"], "form": trend["form"], "expression": trend["expression"],
        "keywords": keywords[:40], "quotes": quotes, "images": images, "claim": claim,
    })

out = {
    "seasonLabel": src["seasonLabel"], "seasonCode": src["seasonCode"],
    "periodLabel": src["periodLabel"], "intro": src["intro"],
    "boards": tax["boards"], "trends": out_trends,
}
json.dump(out, open(os.path.join(ROOT, "data/trends.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

print(f"trends={len(out_trends)} quotes={sum(len(t['quotes']) for t in out_trends)} "
      f"images={sum(len(t['images']) for t in out_trends)}")
for p in problems:
    print("  !", p)
