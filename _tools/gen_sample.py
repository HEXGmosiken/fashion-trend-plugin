"""Generate data/evidence.sample.json — clearly synthetic demo data."""
import json, random

random.seed(7)

A_SRC = ["src-vogue", "src-vogue-uk", "src-wwd", "src-hb", "src-www", "src-fu", "src-bof"]
B_SRC = ["src-vogue", "src-wwd", "src-hb", "src-www", "src-tzr", "src-fu",
         "src-zh-vogue", "src-zh-jiemian", "src-zh-ladymax"]

ZH = {
    "sheer_t": ["半透明薄纱直接作为外层，覆盖整身长裙。", "欧根纱叠穿在西装之外，形成第二层轮廓。",
                "透视针织与蕾丝拼接，能看见内层结构。"],
    "sheer_f": ["面料以不透明羊毛与皮革为主，没有出现明显透视层次。", "整场以厚重毛呢构成，未见薄纱或网眼。",
                "廓形靠结构撑起，而不是靠透明面料。"],
    "check_t": ["整体以威尔士亲王格纹套装为主。", "苏格兰格纹大衣贯穿全场。", "窗格纹被用在短外套与半裙上。"],
    "check_f": ["印花是花卉与抽象色块，没有出现格纹。", "面料以纯色斜纹与皮革为主，格纹缺席。",
                "图案集中在条纹与波点，未见格纹。"],
    "tail_t": ["宽肩定制西装搭配低腰长裤。", "三件套西装用松量剪裁重做。", "收腰西装外套与阔腿西裤成套出现。"],
    "tail_f": ["以针织与运动面料为主，未见定制西装。", "轮廓偏柔软，西装只出现在闭场一件。",
               "整体是连衣裙与罩衫，几乎没有剪裁外套。"],
    "pre": ["本季秀场评论指出，", "编辑复盘认为，", "订货会反馈显示，"],
}

EN = {
    "sheer_t": ["sheer organza was layered over tailoring as an outer shell",
                "gauze dresses deliberately revealed the underlayer"],
    "sheer_f": ["the fabric story was opaque wool and leather, with no sheer layering",
                "the silhouettes were built by structure rather than transparency"],
    "check_t": ["prince-of-wales check suiting dominated the lineup",
                "tartan coats ran through the whole show"],
    "check_f": ["prints were florals and abstract colour blocks; no check appeared",
                "the surface story was solid twill and leather"],
    "tail_t": ["oversized tailored blazers were paired with low-slung trousers",
               "three-piece suits were recut with generous volume"],
    "tail_f": ["knitwear and jersey dominated; tailoring appeared only in the finale",
               "the silhouettes stayed soft, with almost no tailored outerwear"],
    "pre": ["The show review notes that", "Editors observed that", "The report says that"],
}


def make_excerpt(flags, lang, i):
    t = ZH if lang == "zh" else EN
    parts = [random.choice(t["sheer_t" if flags["sheer"] else "sheer_f"]),
             random.choice(t["check_t" if flags["check"] else "check_f"]),
             random.choice(t["tail_t" if flags["tailoring"] else "tail_f"])]
    pre = random.choice(t["pre"])
    if lang == "zh":
        return pre + parts[0] + parts[1]
    return f"{pre} {parts[0]}; {parts[1]}."


A_DATES = ["2026-02-05", "2026-02-10", "2026-02-15", "2026-02-20", "2026-02-25",
           "2026-03-02", "2026-03-07", "2026-03-12", "2026-03-17", "2026-03-22",
           "2026-03-27", "2026-04-01", "2026-04-06", "2026-04-11", "2026-04-16"]
B_DATES = ["2026-09-05", "2026-09-08", "2026-09-11", "2026-09-14", "2026-09-17",
           "2026-09-20", "2026-09-23", "2026-09-26", "2026-09-29", "2026-10-02",
           "2026-10-05", "2026-10-08", "2026-10-11", "2026-10-14", "2026-10-17"]

a_sheer = {2, 7, 11}
a_check = {1, 3, 4, 6, 8, 9, 10, 13}
a_tail = {1, 5, 10}
b_sheer = set(range(1, 16)) - {4, 9, 14}
b_check = {2, 7, 12}
b_tail = {1, 2, 3, 5, 6, 8, 9, 10, 11, 13}

rows = []
for i in range(1, 16):
    sid = A_SRC[(i - 1) % len(A_SRC)]
    lang = "zh" if sid.startswith("src-zh") else "en"
    flags = {"sheer": i in a_sheer, "check": i in a_check, "tailoring": i in a_tail}
    rows.append({
        "id": f"E-A{i:02d}",
        "sourceId": sid,
        "url": f"https://demo.runway.example/fw26/review-{i:02d}",
        "title": f"FW26 秀场评论 #{i:02d}（合成示例）",
        "publishedAt": A_DATES[i - 1],
        "accessedAt": "2026-11-01",
        "season": "FW26",
        "window": "A",
        "brand": f"Example Brand {(i % 6) + 1}",
        "category": "womenswear",
        "excerpt": make_excerpt(flags, lang, i),
        "originality": "reprint" if i == 6 else "original",
        "isSponsored": i == 13,
        "codings": flags,
    })

for i in range(1, 16):
    sid = B_SRC[(i - 1) % len(B_SRC)]
    lang = "zh" if sid.startswith("src-zh") else "en"
    flags = {"sheer": i in b_sheer, "check": i in b_check, "tailoring": i in b_tail}
    rows.append({
        "id": f"E-B{i:02d}",
        "sourceId": sid,
        "url": f"https://demo.runway.example/ss27/review-{i:02d}",
        "title": f"SS27 秀场评论 #{i:02d}（合成示例）",
        "publishedAt": B_DATES[i - 1],
        "accessedAt": "2026-11-01",
        "season": "SS27",
        "window": "B",
        "brand": f"Example Brand {(i % 6) + 1}",
        "category": "womenswear",
        "excerpt": make_excerpt(flags, lang, i),
        "originality": "translation" if i == 8 else "original",
        "isSponsored": i == 12,
        "codings": flags,
    })

# 故意放一条同 URL + 同标题的重复，用来验证去重链路
rows.append({
    "id": "E-B16",
    "sourceId": "src-vogue-uk",
    "url": "https://demo.runway.example/ss27/review-01?utm_source=newsletter",
    "title": "SS27 秀场评论 #01（合成示例）",
    "publishedAt": "2026-09-06",
    "accessedAt": "2026-11-01",
    "season": "SS27",
    "window": "B",
    "brand": "Example Brand 1",
    "category": "womenswear",
    "excerpt": make_excerpt({"sheer": True, "check": False, "tailoring": True}, "en", 1),
    "originality": "reprint",
    "isSponsored": False,
    "codings": {"sheer": True, "check": False, "tailoring": True},
})

data = {"dataset": "synthetic-demo-v1", "synthetic": True, "evidence": rows}
with open(r"D:\chajian\data\evidence.sample.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("rows", len(rows))
for k in ("sheer", "check", "tailoring"):
    print(k, "A=", sum(r["codings"][k] for r in rows if r["window"] == "A"),
          "B=", sum(r["codings"][k] for r in rows if r["window"] == "B"))
