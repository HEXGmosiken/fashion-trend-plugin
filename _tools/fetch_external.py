"""抓外部权威媒体的趋势分析文章，抽出正文，存成 JSON。"""
import json, re, gzip, zlib, os, sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from lxml import html as LH

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
OUT = r"D:\chajian\data\external\articles.json"

URLS = [
    ("vogue", "https://www.vogue.com/article/the-top-trends-of-the-spring-2027-ready-to-wear-season"),
    ("vogue", "https://www.vogue.com/article/fall-winter-2026-fashion-trends"),
    ("vogue", "https://www.vogue.com/article/from-the-celine-belt-to-prada-purple-these-were-the-street-style-trends-of-the-spring-2027-ready-to-wear-shows"),
    ("vogue", "https://www.vogue.com/article/a-theory-of-the-it-item-vogue-editors-present-their-picks-for-spring-2027"),
    ("vogue", "https://www.vogue.com/article/bye-bye-clean-girl-6-trend-predictions-for-spring-summer-2027"),
    ("vogue", "https://www.vogue.com/article/velvet-flats-trend"),
    ("vogue", "https://www.vogue.com/article/brown-jeans-fall-trend"),
    ("vogue", "https://www.vogue.com/article/street-styles-most-wanted-shoes-of-the-spring-2027-season"),
    ("bof", "https://www.businessoffashion.com/podcasts/fashion-week/how-independent-thinking-powered-the-springsummer-2027-shows/"),
    ("bof", "https://www.businessoffashion.com/articles/luxury/the-great-fashion-reset-when-will-luxury-bounce-back/"),
    ("bof", "https://www.businessoffashion.com/articles/fashion-week/the-top-10-shows-of-the-season-2/"),
    ("wwd", "https://wwd.com/fashion-news/shows-reviews/advanced-contemporary-brands-emphasis-emininity-romanticism-edge-1239227087/"),
    ("wwd", "https://wwd.com/sourcing-journal/sj-denim/trendalytics-slim-fit-denim-statement-pockets-trending-1239208511/"),
    ("wwd", "https://wwd.com/fashion-news/fashion-features/retail-reactioncolors-elevated-outerwear-lingerie-styles-fringe-key-trend-spring-2027-1239238494/"),
    ("wwd", "https://wwd.com/footwear-news/shoe-trends/high-vamp-pumps-shoe-trends-fall-2026-1239123472/"),
    ("voguebusiness", "https://www.voguebusiness.com/story/fashion/are-diy-creators-fashions-next-big-influencers"),
    ("pantone", "https://www.pantone.com/fashion-color-trend-report/new-york-fashion-week-spring-summer-2027"),
    ("pantone", "https://www.pantone.com/articles/fashion-color-trend-report/new-york-fashion-week-autumn-winter-2026"),
    ("wgsn", "https://www.wgsn.com/de/node/2551"),
    ("wgsn", "https://www.wgsn.com/fr/node/2452"),
    ("fashionista", "https://fashionista.com/2026/08/copenhagen-fashion-week-spring-2027-trends"),
    ("fashionista", "https://fashionista.com/2025/04/wgsn-color-of-the-year-2027-luminous-blue"),
    ("bazaar", "https://www.harpersbazaar.com/fashion/fashion-week/a74111249/fall-2026-runway-trends_1791832659/"),
    ("bazaar", "https://www.harpersbazaar.com/fashion/a74069615/spring-2027-orange-color-trend/"),
    ("elle", "https://www.elle.com/runway/a74056583/paris-fashion-week-spring-2027-trends/"),
    ("elle-au", "https://www.elle.com.au/shopping/embellished-trend-how-to-wear/"),
    ("thecut", "https://www.thecut.com/article/cut-fashion-closet-joanna-nikas-fall-2026.html"),
    ("thecut", "https://www.thecut.com/article/how-to-style-the-best-fall-2026-runway-trends.html"),
    ("w", "https://nc.wmagazine.com/fashion/spring-2027-runway-trends-photos"),
    ("w", "https://nc.wmagazine.com/fashion/accessories-trends-spring-2027-bags-shoes-jewelry"),
    ("w", "https://www.wmagazine.com/fashion/ferragamo-spring-2027-runway-photos"),
    ("another", "https://www.anothermag.com/fashion-beauty/17531/balmain-antonin-tron-ss27-review-paris-fashion-week"),
    ("dazed", "https://www.dazeddigital.com/fashion/article/71242/1/why-heeled-trainers-are-having-a-moment-converse-nike-lacoste-simone-rocha"),
    ("guardian", "https://www.theguardian.com/fashion/2026/sep/11/gardening-fashion-cool-monty-don"),
    ("guardian", "https://www.theguardian.com/fashion/2026/jul/17/return-of-the-ringer-t-shirt"),
    ("guardian", "https://www.theguardian.com/fashion/2026/nov/08/met-gala-2027-theme-poetics-everyday"),
    ("nyt", "https://www.nytimes.com/2026/10/08/t-magazine/fashion-month-questions-takeaways.html"),
    ("nyt", "https://www.nytimes.com/2026/10/30/t-magazine/halloween-costume-inspiration-spring-fashion-runways.html"),
    ("independent", "https://www.independent.co.uk/news/prada-milan-miuccia-prada-raf-simons-b3055090.html"),
    ("independent", "https://www.independent.co.uk/news/chanel-nicole-kidman-virginie-viard-dua-lipa-paris-b3061991.html"),
]

DROP = ["script", "style", "noscript", "svg", "iframe", "form", "nav", "header", "footer", "aside", "button"]
JUNK = re.compile(r"(share|social|related|promo|newsletter|subscribe|signin|login|paywall|consent|cookie|"
                  r"breadcrumb|menu|navbar|advert|sponsor|comment|sidebar|most-read|recommend|trending)", re.I)


def get(url, timeout=35):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA, "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        enc = (r.headers.get("Content-Encoding") or "").lower()
        if "gzip" in enc:
            raw = gzip.decompress(raw)
        elif "deflate" in enc:
            raw = zlib.decompress(raw, -zlib.MAX_WBITS)
        cs = r.headers.get_content_charset()
        if not cs:
            m = re.search(rb'charset=["\']?([\w\-]+)', raw[:4000], re.I)
            cs = m.group(1).decode() if m else "utf-8"
        return raw.decode(cs, "ignore")


def extract(html_text):
    doc = LH.fromstring(html_text)
    title = ""
    for xp in ("//meta[@property='og:title']/@content", "//title/text()", "//h1//text()"):
        v = doc.xpath(xp)
        if v and str(v[0]).strip():
            title = " ".join(str(v[0]).split())
            break
    date = ""
    for xp in ("//meta[@property='article:published_time']/@content",
               "//meta[@name='article:published_time']/@content"):
        v = doc.xpath(xp)
        if v:
            date = str(v[0])[:10]
            break
    for tag in DROP:
        for e in doc.xpath("//" + tag):
            try:
                e.drop_tree()
            except Exception:
                pass
    best, score = None, 0
    for node in doc.xpath("//article | //main | //div | //section"):
        ps = [p for p in node.xpath(".//p") if len((p.text_content() or "").strip()) >= 60]
        if len(ps) < 3:
            continue
        s = sum(len((p.text_content() or "").strip()) for p in ps)
        if s > score:
            best, score = node, s
    node = best if best is not None else doc
    for e in node.xpath(".//*[@class or @id]"):
        blob = " ".join(filter(None, [e.get("class"), e.get("id")]))
        if blob and JUNK.search(blob):
            try:
                if len((e.text_content() or "")) < 1200:
                    e.drop_tree()
            except Exception:
                pass
    paras = []
    for p in node.xpath(".//p"):
        t = " ".join((p.text_content() or "").split())
        if len(t) >= 60:
            paras.append(t)
    return title, date, "\n\n".join(paras)


def one(item):
    src, url = item
    try:
        html_text = get(url)
        title, date, text = extract(html_text)
        return {"source": src, "url": url, "title": title, "date": date,
                "chars": len(text), "text": text, "ok": len(text) > 800}
    except Exception as e:
        return {"source": src, "url": url, "title": "", "date": "", "chars": 0,
                "text": "", "ok": False, "error": f"{type(e).__name__}: {e}"[:120]}


if __name__ == "__main__":
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with ThreadPoolExecutor(max_workers=6) as ex:
        rows = list(ex.map(one, URLS))
    ok = [r for r in rows if r["ok"]]
    json.dump(rows, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"total={len(rows)} ok={len(ok)} chars={sum(r['chars'] for r in ok)}")
    for r in rows:
        if not r["ok"]:
            print("  ", r["source"], r["chars"], r.get("error", ""), r["url"][:70])
