"""Download hero images for the real corpus, keeping only usable ones.

Rules: og:image -> twitter -> JSON-LD -> first plausible <img>;
accept only if width >= 700 and height >= 420 (portrait included).
"""
import json, os, re, gzip, zlib, io
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from lxml import html as LH
from PIL import Image

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
OUT = r"D:\chajian\assets\img"
MAN = r"D:\chajian\data\images.manifest.json"
MAXW = 1400
MINW, MINH = 700, 420
BAD_IMG = re.compile(r"(logo|icon|avatar|qr|sprite|placeholder|loading|blank|advert|badge|wechat|weibo|share)", re.I)


def get(url, referer=None, binary=False, timeout=40):
    h = {"User-Agent": UA,
         "Accept": "image/avif,image/webp,image/*,*/*;q=0.8" if binary else "text/html,*/*;q=0.8",
         "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8"}
    if referer:
        h["Referer"] = referer
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        enc = (r.headers.get("Content-Encoding") or "").lower()
        if "gzip" in enc:
            raw = gzip.decompress(raw)
        elif "deflate" in enc:
            raw = zlib.decompress(raw, -zlib.MAX_WBITS)
        if binary:
            return raw
        cs = r.headers.get_content_charset() or "utf-8"
        return raw.decode(cs, "ignore")


def candidates(html_text, base):
    doc = LH.fromstring(html_text)
    out = []
    for xp in ("//meta[@property='og:image']/@content",
               "//meta[@name='twitter:image']/@content",
               "//meta[@property='twitter:image']/@content",
               "//meta[@itemprop='image']/@content"):
        for v in doc.xpath(xp):
            if str(v).startswith("http"):
                out.append(str(v))
    for raw in doc.xpath("//script[@type='application/ld+json']/text()"):
        for m in re.finditer(r'"image"\s*:\s*"(https?://[^"]+)"', raw):
            out.append(m.group(1))
    host = base.split("//")[1].split("/")[0]
    for img in doc.xpath("//img"):
        for attr in ("data-original", "data-src", "data-lazy-src", "src"):
            src = img.get(attr)
            if not src:
                continue
            if src.startswith("//"):
                src = "https:" + src
            elif src.startswith("/"):
                src = "https://" + host + src
            if not src.startswith("http"):
                continue
            if not re.search(r"\.(jpe?g|png|webp)(\?|$)", src, re.I):
                continue
            if BAD_IMG.search(src):
                continue
            out.append(src)
            break
    seen, uniq = set(), []
    for u in out:
        if u not in seen:
            seen.add(u)
            uniq.append(u)
    return uniq[:8]


def one(ev):
    path = os.path.join(OUT, ev["id"] + ".jpg")
    if os.path.exists(path):
        try:
            with Image.open(path) as im0:
                w, h = im0.size
            if w >= MINW and h >= MINH:
                return {"id": ev["id"], "status": "cached", "file": path, "w": w, "h": h}
        except Exception:
            pass
        os.remove(path)

    try:
        html_text = get(ev["url"])
    except Exception as e:
        return {"id": ev["id"], "status": "err", "error": f"page: {type(e).__name__}: {e}"[:120]}

    for url in candidates(html_text, ev["url"]):
        try:
            raw = get(url, referer=ev["url"], binary=True)
            im = Image.open(io.BytesIO(raw)).convert("RGB")
            if im.width < MINW or im.height < MINH:
                continue
            if im.width > MAXW:
                im = im.resize((MAXW, int(im.height * MAXW / im.width)), Image.LANCZOS)
            im.save(path, "JPEG", quality=82, optimize=True)
            return {"id": ev["id"], "status": "ok", "file": path,
                    "w": im.width, "h": im.height, "img": url}
        except Exception:
            continue
    return {"id": ev["id"], "status": "no-usable-image"}


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    data = json.load(open(r"D:\chajian\data\evidence.real.json", encoding="utf-8"))
    res = []
    with ThreadPoolExecutor(max_workers=6) as ex:
        for r in ex.map(one, data["evidence"]):
            res.append(r)
    json.dump({r["id"]: r for r in res}, open(MAN, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    ok = [r for r in res if r["status"] in ("ok", "cached")]
    print(f"total={len(res)} ok={len(ok)}")
    for r in res:
        if r["status"] not in ("ok", "cached"):
            print("  ", r["id"], r["status"], r.get("error", ""))
