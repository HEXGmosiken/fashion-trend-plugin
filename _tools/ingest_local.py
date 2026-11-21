"""把本地保存的网页（或纯文本）整理成文章库 articles.json —— 不联网、不爬取。

为什么不用爬虫：
  现在的语料靠检索得来，正文由人工保存。这个工具只做"整理入库"：
  校验字段、抽取正文、去重、统一时间格式，不负责访问网络。

输入目录结构（默认 data/external/inbox/）：
  inbox/
    manifest.csv        必需，列：file,source,url,date
    *.html / *.txt      浏览器"另存为"得到的页面，或复制下来的正文

  manifest.csv 示例：
    file,source,url,date
    0001.html,vogue,https://www.vogue.com/article/xxx,2026-03-05
    0002.txt,bof,https://www.businessoffashion.com/articles/yyy,

输出：
  data/external/articles.json   与 _tools/fetch_external.py 相同的字段
  data/external/report.txt      逐条结果与失败原因

用法：
  python _tools/ingest_local.py
  python _tools/ingest_local.py --inbox data/external/inbox --out data/external/articles.json
  python _tools/ingest_local.py --check data/external/articles.json   # 只检查已有文件
"""
import argparse
import csv
import hashlib
import html
import json
import os
import re
import sys

JUNK = re.compile(r"(nav|menu|footer|header|sidebar|comment|share|related|advert|cookie|newsletter|subscribe)", re.I)
BLOCK = re.compile(r"<(script|style|noscript|nav|footer|header|aside|form)[^>]*>.*?</\1>", re.I | re.S)
TAG = re.compile(r"<[^>]+>")
WS = re.compile(r"\s+")


def text_of(path):
    with open(path, "rb") as f:
        raw = f.read()
    for enc in ("utf-8", "utf-8-sig", "gb18030", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "ignore")


def html_title(doc):
    for pat in (r"<meta[^>]+property=[\"']og:title[\"'][^>]+content=[\"']([^\"']+)",
                r"<title[^>]*>(.*?)</title>",
                r"<h1[^>]*>(.*?)</h1>"):
        m = re.search(pat, doc, re.I | re.S)
        if m:
            return clean(m.group(1))
    return ""


def html_date(doc):
    for pat in (r"<time[^>]+datetime=[\"']([\d\-/T: ]+)",
                r"<meta[^>]+property=[\"']article:published_time[\"'][^>]+content=[\"']([\d\-/T: ]+)",
                r"<meta[^>]+name=[\"']date[\"'][^>]+content=[\"']([\d\-/T: ]+)"):
        m = re.search(pat, doc, re.I)
        if m:
            d = m.group(1).strip()[:10].replace("/", "-")
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", d):
                return d
    return ""


def clean(s):
    s = html.unescape(TAG.sub(" ", s))
    return WS.sub(" ", s).strip()


def html_body(doc):
    """取长度 >= 60 的段落，按正文密度挑一段最像正文的容器。"""
    m = re.search(r"<article[^>]*>(.*?)</article>", doc, re.I | re.S)
    scope = m.group(1) if m else BLOCK.sub(" ", doc)
    paras = []
    for p in re.findall(r"<p[^>]*>(.*?)</p>", scope, re.I | re.S):
        t = clean(p)
        if len(t) >= 60:
            paras.append(t)
    if len(paras) < 3:  # 退化为按行切
        plain = clean(scope)
        paras = [x for x in re.split(r"(?<=[。.!?])\s+", plain) if len(x) >= 60]
    return "\n\n".join(paras)


def plain_body(txt):
    paras = [WS.sub(" ", x).strip() for x in txt.split("\n")]
    return "\n\n".join(p for p in paras if len(p) >= 60)


def fingerprint(text):
    norm = re.sub(r"[^0-9a-zA-Z\u4e00-\u9fa5]", "", text.lower())[:400]
    return hashlib.sha1(norm.encode("utf-8")).hexdigest()


def read_manifest(inbox):
    path = os.path.join(inbox, "manifest.csv")
    if not os.path.exists(path):
        sys.exit(f"缺少清单文件：{path}（列：file,source,url,date）")
    rows = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            if not r.get("file"):
                continue
            rows.append({
                "file": r["file"].strip(),
                "source": (r.get("source") or "").strip(),
                "url": (r.get("url") or "").strip(),
                "date": (r.get("date") or "").strip(),
            })
    return rows


def ingest(inbox, out, min_chars=400):
    rows = read_manifest(inbox)
    seen_url, seen_fp = set(), {}
    out_rows, report = [], []

    for r in rows:
        path = os.path.join(inbox, r["file"])
        rec = {"source": r["source"], "url": r["url"], "title": "", "date": r["date"],
               "chars": 0, "text": "", "ok": False}
        if not os.path.exists(path):
            rec["error"] = "文件不存在"
            out_rows.append(rec)
            report.append(f"✗ {r['file']}：文件不存在")
            continue

        doc = text_of(path)
        if path.lower().endswith((".html", ".htm")):
            rec["title"] = html_title(doc)
            rec["date"] = rec["date"] or html_date(doc)
            body = html_body(doc)
        else:
            body = plain_body(doc)
            rec["title"] = rec["title"] or (body.split("\n")[0][:40] if body else "")

        rec["text"], rec["chars"] = body, len(body)
        rec["ok"] = len(body) >= min_chars

        if rec["url"] and rec["url"] in seen_url:
            rec["ok"], rec["error"] = False, "URL 重复"
        elif body and fingerprint(body) in seen_fp:
            rec["ok"], rec["error"] = False, f"正文重复（与 {seen_fp[fingerprint(body)]}）"
        elif not rec["ok"]:
            rec["error"] = "正文过短，可能是导航页或付费墙"

        if rec["url"]:
            seen_url.add(rec["url"])
        if body:
            seen_fp.setdefault(fingerprint(body), r["file"])
        out_rows.append(rec)
        mark = "✓" if rec["ok"] else "✗"
        report.append(f"{mark} {r['file']}｜{rec['source']}｜{rec['chars']}字符｜{rec.get('error', '')}")

    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(out_rows, f, ensure_ascii=False, indent=1)

    ok = [x for x in out_rows if x["ok"]]
    summary = (f"共 {len(out_rows)} 条，可用 {len(ok)} 条，"
               f"正文合计 {sum(x['chars'] for x in ok)} 字符")
    with open(os.path.join(os.path.dirname(out) or ".", "report.txt"), "w", encoding="utf-8") as f:
        f.write(summary + "\n\n" + "\n".join(report) + "\n")
    print(summary)
    for line in report:
        print("  ", line)


def check(path):
    data = json.load(open(path, encoding="utf-8"))
    bad = [x for x in data if not x.get("ok")]
    print(f"总数 {len(data)}，可用 {len(data) - len(bad)}，异常 {len(bad)}")
    for x in bad:
        print("  ✗", x.get("source"), x.get("url", "")[:60], x.get("error") or f"{x.get('chars')}字符")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--inbox", default="data/external/inbox")
    ap.add_argument("--out", default="data/external/articles.json")
    ap.add_argument("--min-chars", type=int, default=400)
    ap.add_argument("--check")
    a = ap.parse_args()
    if a.check:
        check(a.check)
    else:
        ingest(a.inbox, a.out, a.min_chars)
