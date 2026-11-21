import json, re

p = r"D:\chajian\data\corpus\patterns.json"
d = json.load(open(p, encoding="utf-8"))

DROP = {"P22"}
d["patterns"] = [x for x in d["patterns"] if x["id"] not in DROP]

FIX = {
    "不再执着于对鼎盛时代的性感崇拜，而是聚焦身体本身": "把注意力从鼎盛时代的性感崇拜移到身体本身",
    "重点不再是{A}，而是{B}": "重心从{A}移到{B}",
    "{A}和{B}同时在场，不是谁替代谁": "{A}和{B}同时在场，各自占住一半",
    "转向不是一边倒，是在{A}与{B}之间": "转向发生在{A}与{B}之间",
    "不再思考还能往上加什么，转而思考还能去掉什么": "把加法停住，开始做减法",
    "不再受{A}支配": "从{A}的支配里退出",
}

for x in d["patterns"]:
    for k in ("template", "when"):
        if isinstance(x.get(k), str):
            for a, b in FIX.items():
                x[k] = x[k].replace(a, b)
    x["examples"] = [FIX.get(e, e) for e in x.get("examples", [])]

# 兜底：清掉仍含否定-肯定结构的例句
bad = re.compile(r"不是|而是|并非|不在于")
for x in d["patterns"]:
    x["examples"] = [e for e in x["examples"] if not bad.search(e)]
    if bad.search(x["template"]):
        print("still bad template:", x["id"], x["template"])

json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("patterns:", len(d["patterns"]))

left = [x["id"] for x in d["patterns"] if bad.search(json.dumps(x, ensure_ascii=False))]
print("remaining flagged:", left)

s = json.load(open(r"D:\chajian\data\corpus\summary.json", encoding="utf-8"))
S = {
    "thesis": "这一季把加法放回了衣服表面：刺绣、蕾丝、珠绣同时回到样本里，穿它们的场合却压在日常与职场，静奢与极简退成底色。",
    "p1": "变化最先发生在表面。刺绣、蕾丝、珠绣在样本里同时出现，设计师重新愿意在面料上做加法，剪裁退到次要位置。",
    "p2": "加法没有变成炫耀。静奢与极简各占一成六，黑色仍是最常被提到的颜色；装饰加在克制之上，克制的底子没有动。",
    "p3": "真正变化的是穿着场景。日常占据一半以上，职场接近三成，晚宴只有两成多；装饰被穿去上班，派对只是其中一站。",
    "counter": "反证也要摆出来：皮革仍是提及率最高的材质，静奢与极简合计三成，硬朗与克制没有退场，只是不再占据叙事中心。",
    "close": "所以更准确的说法是：繁荣与克制叠在同一件衣服上，外层负责表达，内层负责可穿。",
}
s["thesis"] = S["thesis"]
s["paragraphs"][0]["claim"] = S["p1"]
s["paragraphs"][1]["claim"] = S["p2"]
s["paragraphs"][2]["claim"] = S["p3"]
s["counter"]["claim"] = S["counter"]
s["close"] = S["close"]
json.dump(s, open(r"D:\chajian\data\corpus\summary.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)

txt = json.dumps(s, ensure_ascii=False)
print("summary banned hits:", len(bad.findall(txt)))
