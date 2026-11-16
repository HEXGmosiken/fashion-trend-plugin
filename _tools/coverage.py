"""用外部媒体语料验证句式库：命中率、未覆盖句式、需要补的模板。"""
import json, re, os
from collections import Counter

ROOT = r"D:\chajian"
data = json.load(open(os.path.join(ROOT, "data/external/articles.json"), encoding="utf-8"))
arts = [a for a in data if a.get("ok")]
texts = [a["text"] for a in arts]


def sentences(t):
    out = []
    for part in re.split(r"(?<=[.!?。！？])\s*|\n+", t):
        s = re.sub(r"\s+", " ", part).strip()
        if 40 < len(s) < 230:
            out.append(s)
    return out


sents = []
for a in arts:
    for s in sentences(a["text"]):
        sents.append((a["source"], s))

# 类型级检测器（中英双语）
TYPES = {
    "shift": r"(shift(ing|ed)? (to|toward|away)|turn(ing|ed)? (to|toward)|from .{3,50} to |rather than|instead of|从.{2,14}转(向|为)|不再.{2,14}(而是|转而))",
    "structure": r"(silhouette|proportion|shoulder|waistline|hemline|tailoring|drape|volume|cut\b|廓形|肩线|腰线|剪裁|垂坠|量感|版型)",
    "pairing": r"(pair(ed|ing)? with|styled with|layer(ed|ing)? (with|under|over)|worn (with|over)|配|搭|叠穿|外搭)",
    "color": r"(colou?r|palette|shade|hue|tone|色|调色盘|配色)",
    "evidence": r"(\d+(\.\d+)?\s?%|percent|per cent|增长|上升|下降|翻倍|doubl)",
    "contrast": r"(while |whereas|compared (with|to)|in contrast|on the other hand|一边|相比|反观|而另一边)",
    "conclusion": r"(not (just )?a[n]? .{2,40}, but|isn't .{2,40}, it's|不是.{2,14}而是|与其说.{2,14}不如说)",
    "thesis": r"(the season|this season|next season|关键词|这一季|下一季)",
}

counts = Counter()
hits = {k: [] for k in TYPES}
for src, s in sents:
    for k, pat in TYPES.items():
        if re.search(pat, s, re.I):
            counts[k] += 1
            if len(hits[k]) < 3:
                hits[k].append((src, s))

total = len(sents)
print("articles", len(arts), "sentences", total)
for k in TYPES:
    print(f"{k:11s} {counts[k]:5d}  {counts[k]/total*100:5.1f}%")

# 现有 24 个模板的启发式覆盖（按句式骨架近似）
PATTERNS = json.load(open(os.path.join(ROOT, "data/corpus/patterns.json"), encoding="utf-8"))["patterns"]
PROBES = {
    "P01": r"(shift(ing|ed)? (from|to)|turn(ing|ed)? (from|to)|从.{2,14}(转|变))",
    "P02": r"(退潮|走下神坛|on the way out|left the chat|fading)",
    "P03": r"(rather than|instead of|不再.{2,14}(而是|转而))",
    "P04": r"(replac|取代|替代)",
    "P05": r"(give way|让位|让给)",
    "P06": r"((push|move|drop|set).{0,30}(waist|shoulder|hem)|把.{0,12}(推|移|放)(到|至))",
    "P07": r"(new (grammar|uniform|uniforms)|成为.{0,8}(语法|标配|主角))",
    "P08": r"(proportion|比例|身长)",
    "P09": r"(balance between|之间(找到|取得)?平衡)",
    "P10": r"(pair(ed)? with|配.{0,6}(搭|穿))",
    "P11": r"(key (piece|item)|关键单品|点睛)",
    "P12": r"(soften|temper|中和|柔化)",
    "P13": r"(re-?enter|return(ed)? to|重回|重新回到)",
    "P14": r"(palette (shift|move)|调色盘从|从.{0,8}色(系)?转向)",
    "P15": r"(the new black|替代品|new neutral)",
    "P16": r"\d+\s?(篇|articles?).{0,20}(提到|mention)",
    "P17": r"(compared (with|to)|高出|低.{0,3}点)",
    "P18": r"\d+(\.\d+)?%.{0,30}\d+(\.\d+)?%",
    "P19": r"(one side|the other|一边是|一边.{0,10}另一边)",
    "P20": r"(solves|解决的是|answer to)",
    "P21": r"(emotional (outlet|release)|情绪出口|日常落点)",
    "P22": r"(not (a|an) .{2,30}, but|不是.{2,12}而是)",
    "P23": r"(keywords?|关键词)",
    "P24": r"(aesthetic (shift|turn)|审美.{0,6}转向)",
}
cov = {}
for p in PATTERNS:
    probe = PROBES.get(p["id"])
    cov[p["id"]] = sum(1 for _, s in sents if probe and re.search(probe, s, re.I))

print("\npattern coverage:")
for p in PATTERNS:
    print(f"  {p['id']} {p['type']:10s} {cov[p['id']]:4d}  {p['template'][:26]}")
json.dump({"total": total, "types": counts, "pattern": cov},
          open(os.path.join(ROOT, "data/external/coverage.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

# 未覆盖的高价值句式：带编辑判断色彩但不匹配上面探测器的句子
unmatched = []
for src, s in sents:
    if re.search(r"(is the new|having a moment|is back|returns? to|replaces?|no longer|quiet luxury|maximalis)", s, re.I):
        unmatched.append((src, s))
print("\nunmatched candidates:", len(unmatched))
for src, s in unmatched[:12]:
    print(" -", src, "|", s[:150])
json.dump(unmatched, open(os.path.join(ROOT, "data/external/unmatched.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
