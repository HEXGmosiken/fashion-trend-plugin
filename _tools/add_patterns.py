import json

p = r"D:\chajian\data\corpus\patterns.json"
d = json.load(open(p, encoding="utf-8"))
have = {x["id"] for x in d["patterns"]}

NEW = [
    ("P25", "shift", "{A} is the new {B}", {"A": "新事物", "B": "旧默认"},
     ["The bra top is the new T-shirt"],
     "英文媒体最常用的『替代』句式，适合开篇或分论点"),
    ("P26", "shift", "{A} is back", {"A": "回归的对象"},
     ["The straight leg jean is back and here to stay"],
     "回归叙事，语气比 『取代』轻，适合单品"),
    ("P27", "shift", "{A} has replaced {B} as {C}", {"A": "新主角", "B": "旧主角", "C": "位置"},
     ["Rider's Celine Maison belt has officially replaced the Gucci Marmont belt as the waist-cincher du jour"],
     "有明确替代关系且需要一个『位置』时使用"),
    ("P28", "shift", "leave behind the {A} era", {"A": "旧时代"},
     ["as we slowly leave behind the quiet luxury, clean girl era"],
     "一个时代结束的叙事，适合总述的转折段"),
    ("P29", "shift", "{A} is having a moment", {"A": "正在走红的对象"},
     ["the decadent footwear trend is having a moment this fall"],
     "比『流行』更克制的说法，适合单点观察"),
    ("P30", "shift", "no longer beholden to {A}", {"A": "旧规则"},
     ["we're no longer beholden to the style diktats of yore"],
     "拒绝旧规则的叙述，适合风格美学板块"),
]

added = 0
for pid, typ, tpl, slots, ex, when in NEW:
    if pid in have:
        continue
    d["patterns"].append({"id": pid, "type": typ, "template": tpl, "slots": slots,
                          "examples": ex, "when": when})
    added += 1

json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("added", added, "total", len(d["patterns"]))
