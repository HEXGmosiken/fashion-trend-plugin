import json
import re

# 格式：中文|英文|别名（逗号分隔，可空）|一句话定义|板块
# 板块：silhouette 廓形款式 / construction 结构工艺 / material 材质肌理
#       color 色彩 / aesthetic 风格美学 / occasion 场景穿着
DATA = r"""
风衣|trench coat||双排扣、带腰带的防水外套|silhouette
大衣|coat|overcoat|及膝或更长的厚重外套|silhouette
短大衣|car coat||长度到大腿的直筒外套|silhouette
长外套|long coat||过膝的长款外套|silhouette
羽绒服|puffer|down jacket|充绒的保暖外套|silhouette
皮夹克|leather jacket|biker jacket|皮革制短外套|silhouette
飞行夹克|bomber jacket|bomber|收口下摆的短夹克|silhouette
牛仔夹克|denim jacket|trucker jacket|牛仔布短外套|silhouette
西装外套|blazer|suit jacket|有翻领与结构的西式外套|silhouette
无领外套|collarless jacket||去掉翻领的简洁外套|silhouette
长裙|maxi skirt|maxi|长度到脚踝的裙装|silhouette
中长裙|midi skirt|midi|长度过膝到小腿的裙装|silhouette
迷你裙|mini skirt|mini|膝盖以上的短裙|silhouette
铅笔裙|pencil skirt||贴合臀腿的窄裙|silhouette
伞裙|full skirt|circle skirt|下摆展开的蓬松裙|silhouette
百褶裙|pleated skirt||压出规则褶裥的裙装|silhouette
连衣裙|dress|one-piece|上下连体的裙装|silhouette
吊带裙|slip dress||细肩带的简洁裙装|silhouette
衬衫裙|shirt dress||借衬衫结构的连衣裙|silhouette
针织裙|knit dress||针织面料的连衣裙|silhouette
阔腿裤|wide-leg trousers|wide leg|裤腿宽松的长裤|silhouette
直筒裤|straight-leg trousers|straight leg|裤型平直的長裤|silhouette
紧身裤|skinny trousers|skinny|贴合腿型的裤装|silhouette
骑行裤|biker shorts|cycling shorts|及膝的紧身短裤|silhouette
短裤|shorts||膝盖以上的裤装|silhouette
工装裤|cargo trousers|cargo pants|带大口袋的宽松长裤|silhouette
低腰|low-rise|low waist|腰线低于自然腰位的版型|silhouette
高腰|high-waist|high waist|腰线高于自然腰位的版型|silhouette
收腰|cinched waist|waist-cinching|腰部收紧的廓形|silhouette
落肩|dropped shoulder||肩线落到上臂的版型|silhouette
垫肩|padded shoulder|shoulder pad|加垫抬高肩线的结构|silhouette
廓形|silhouette|shape|服装整体的外轮廓|silhouette
量感|volume||面料与结构形成的体积感|silhouette
短款|cropped||衣长明显缩短的版型|silhouette
长线条|longline||纵向拉长的廓形|silhouette
领口|neckline||衣领围合的形状|silhouette
袖型|sleeve|sleeve shape|袖子的宽窄与长短|silhouette
下摆|hem||衣服下缘的形状与处理|silhouette
不对称|asymmetry|asymmetric|左右不平衡的剪裁|silhouette
套装|suit|two-piece|上下同料的成套服装|silhouette
剪裁|tailoring|tailored|按人体结构塑形的工艺|construction
版型|cut|pattern cut|服装的平面结构方案|construction
结构|structure|construction|衣片之间的连接与支撑|construction
省道|dart||收去多余面料的结构线|construction
褶裥|pleat|pleating|压出规则折痕的工艺|construction
褶皱|gathering|ruching|抽缩面料形成的纹理|construction
围裹|wrap|wrapped|用面料包裹身体的穿法|construction
斜裁|bias cut|bias|沿纱线斜向裁剪以贴合身体|construction
拼接|patchwork|panelling|不同面料拼接成衣|construction
解构|deconstruction|deconstructed|拆解原有结构再重组|construction
毛边|raw edge||不做锁边的原始边缘|construction
绗缝|quilting|quilted|缝出格纹的夹层工艺|construction
编织|weave|woven|交织纱线形成面料|construction
钩针|crochet||用钩针编结的工艺|construction
镂空|cut-out|openwork|面料上开出孔洞|construction
抽绳|drawstring||用绳带收放的结构|construction
系带|lacing|tie|用带子固定的结构|construction
盘扣|knot button|frog closure|中式盘结纽扣|construction
立领|mandarin collar|stand collar|竖立的窄领|construction
翻领|lapel||向外翻折的衣领|construction
内衬|lining||衣服内部的衬层|construction
刺绣|embroidery|embroidered|在面料上绣出图案|construction
珠绣|beading|beaded|缝缀珠子做装饰|construction
亮片|sequin|sequined|缝缀反光亮片|construction
流苏|fringe||垂挂的线穗装饰|construction
荷叶边|ruffle|frill|波浪状边缘装饰|construction
开衩|slit||下摆或裙侧开出的缝|construction
层叠|layering|layered|多层叠加的穿法|construction
腰封|waist belt|belted|束在腰部的带状结构|construction
双面呢|double-face||双面可穿的毛呢工艺|construction
立体裁剪|draping|drape on stand|在人台上直接塑形|construction
薄纱|sheer|sheer fabric|轻薄透明的纱质面料|material
欧根纱|organza||硬挺透明的薄纱|material
网纱|tulle|mesh|网眼结构的薄纱|material
蕾丝|lace||镂空花纹的织物|material
雪纺|chiffon||轻薄飘逸的纱质面料|material
真丝|silk||蚕丝织物|material
缎面|satin||表面光滑有光泽的织物|material
丝绒|velvet||表面有短绒的厚重织物|material
灯芯绒|corduroy||表面有纵向绒条的棉织物|material
麂皮|suede||打磨出绒毛的皮革|material
皮革|leather||动物皮或仿皮材质|material
漆皮|patent leather|patent|表面高光泽的皮革|material
纳帕皮|nappa||柔软细腻的羊皮|material
羊羔毛|shearling||带毛的羊皮|material
皮草|fur||动物毛皮|material
仿皮草|faux fur||人造毛皮|material
粗花呢|tweed|bouclé|表面粗糙的羊毛织物|material
羊毛|wool||绵羊毛织物|material
羊绒|cashmere||山羊绒织物|material
马海毛|mohair||安哥拉山羊毛织物|material
针织|knit|knitwear|线圈串套的织物|material
罗纹|rib|ribbed|纵向凸条的针织结构|material
提花|jacquard||织出图案的织物|material
牛仔|denim||斜纹棉布|material
帆布|canvas||厚实平纹棉布|material
塔夫绸|taffeta||硬挺有光泽的丝织物|material
科技面料|technical fabric|performance fabric|功能性合成面料|material
醋酸|acetate||半合成纤维面料|material
粘胶|viscose|rayon|再生纤维素纤维|material
亚麻|linen||亚麻纤维织物|material
棉|cotton||棉纤维织物|material
泡泡纱|seersucker||表面起泡的轻薄棉布|material
金属丝|metallic|metallic yarn|混入金属光泽的纱线|material
压纹|embossed||压出凹凸纹理的工艺|material
做旧|washed|distressed|刻意做出使用痕迹|material
磨毛|brushed||表面起绒的处理|material
光泽|sheen|luster|面料表面的反光感|material
哑光|matte||低反光的表面|material
厚重|heavyweight||克重高、有分量的面料|material
轻薄|lightweight||克重低、轻盈的面料|material
大地色|earth tone|earth tones|取自自然的棕黄灰色系|color
驼色|camel||偏黄的浅棕色|color
焦糖|caramel||偏红的棕黄色|color
巧克力棕|chocolate brown|chocolate|深棕偏黑的褐色|color
咖啡棕|brown|coffee|中等深度的棕色|color
米色|beige||浅米黄的中性色|color
象牙白|ivory||偏黄的白色|color
纯白|white||无彩的白色|color
黑色|black||无彩的黑色|color
炭灰|charcoal||接近黑的深灰|color
鸽灰|dove grey|grey|带蓝调的浅灰|color
酒红|burgundy|oxblood|深沉的暗红|color
樱桃红|cherry red|cherry|明亮偏冷的红|color
辣椒红|chili red||偏橙的高饱和红|color
正红|red||纯正的红色|color
珊瑚粉|coral||偏橙的粉色|color
玫瑰粉|rose|rose pink|带灰调的粉|color
裸粉|nude pink|nude|接近肤色的粉|color
雾霾蓝|dusty blue||掺灰的浅蓝|color
公主蓝|princess blue||明度较高的蓝|color
夜光蓝|luminous blue||带荧光感的亮蓝|color
藏青|navy||偏黑的深蓝|color
牛仔蓝|denim blue||水洗牛仔的蓝|color
湖绿|lagoon||清透的蓝绿|color
橄榄绿|olive||偏黄的暗绿|color
苔藓绿|moss||偏灰的自然绿|color
薄荷绿|mint||浅而清透的绿|color
黄油黄|butter yellow|butter|柔和的浅黄|color
茴香黄|anise||偏绿的浅黄|color
姜黄|turmeric||偏橙的深黄|color
琥珀|amber||暖调的黄棕|color
金属色|metallic||带金属反光的色|color
香槟金|champagne||偏白的浅金|color
银色|silver||金属银灰|color
紫色|purple||红蓝之间的色相|color
梅子紫|plum||偏红的深紫|color
荧光色|neon|fluorescent|高饱和的亮色|color
撞色|color-block|color blocking|强对比配色|color
静奢|quiet luxury|stealth wealth|去掉标识、强调材质的富感|aesthetic
老钱|old money||承袭式的上流审美|aesthetic
极简|minimalism|minimal|做减法的设计取向|aesthetic
繁复|maximalism|maximal|叠加装饰的设计取向|aesthetic
新中式|light Chinese|new Chinese style|把东方结构日常化的设计|aesthetic
国风|guofeng|chinoiserie|取中国传统元素的风格|aesthetic
东方美学|oriental aesthetic|eastern aesthetic|以东方意境为内核的审美|aesthetic
浪漫主义|romanticism|romantic|强调情绪与柔软的表达|aesthetic
波西米亚|bohemian|boho|自由、游牧式的穿法|aesthetic
学院风|preppy|collegiate|源自校园制服的风格|aesthetic
摇滚|rock|punk|带反叛气质的街头风格|aesthetic
垃圾摇滚|grunge||九十年代西雅图的颓废风格|aesthetic
暗黑|dark|gothic|以黑与破损为核心的审美|aesthetic
复古|vintage|retro|取用旧时代的元素|aesthetic
未来主义|futurism|futuristic|强调科技感的取向|aesthetic
机能|techwear|technical|以功能为先的都市装备风|aesthetic
户外|gorpcore|outdoor|借登山装备的日常穿法|aesthetic
运动风|sporty|sportswear|借运动单品的风格|aesthetic
街头|streetwear|street style|源自街头的穿着方式|aesthetic
度假风|resort|resortwear|轻松的假日穿着|aesthetic
田园|cottagecore||回归乡野的浪漫想象|aesthetic
菜园|garden-core||以园艺与劳作为灵感的风格|aesthetic
女神|goddess-core||以垂坠长裙为核心的女神意象|aesthetic
芭蕾风|balletcore||借芭蕾练功服的风格|aesthetic
少女|coquette||强调娇俏与蕾丝的少女感|aesthetic
权力着装|power dressing||用西装建立权威的穿法|aesthetic
实用主义|utilitarianism|utilitarian|以功能与耐穿为先|aesthetic
装饰主义|ornamentalism|ornamental|以装饰为核心的取向|aesthetic
超现实|surrealism|surreal|打破现实逻辑的想象|aesthetic
中性|unisex||不区分性别的设计|aesthetic
无性别|genderless|gender-neutral|弱化性别特征的设计|aesthetic
手作|craft|handmade|强调手工痕迹的取向|aesthetic
侘寂|wabi-sabi||接受不完美与时间的审美|aesthetic
通勤|office|commute|上班场景的穿着|occasion
职场|workwear|work|职业场景的着装|occasion
日常|everyday|daily|非正式场合的基础穿着|occasion
周末|weekend||休闲时段的穿着|occasion
度假|resort|holiday|旅行与假日的穿着|occasion
派对|party||聚会与夜生活的穿着|occasion
晚宴|evening|eveningwear|正式晚间的着装|occasion
红毯|red carpet||公开典礼的着装|occasion
婚礼|wedding|bridal|婚礼相关的穿着|occasion
音乐节|festival||户外音乐活动的穿着|occasion
徒步|hiking|outdoor|户外行走的装备|occasion
运动健身|gym|workout|训练场景的穿着|occasion
瑜伽|yoga||瑜伽练习的服装|occasion
骑行|cycling||骑车场景的服装|occasion
旅行|travel||出行途中的穿着|occasion
居家|loungewear|homewear|在家穿着的舒适服装|occasion
泳装|swimwear|swim|水中活动服装|occasion
演出|performance|stage|舞台表演服装|occasion
约会|date||私人社交场合的穿着|occasion
开学|campus|back to school|校园场景的穿着|occasion
新年|lunar new year|CNY|春节相关的穿着|occasion
换季|transitional||季节交替时的穿着|occasion
"""

rows = []
for line in DATA.strip().splitlines():
    line = line.strip()
    if not line:
        continue
    zh, en, aliases, definition, board = line.split("|")
    rows.append({
        "zh": zh,
        "en": en,
        "aliases": [a for a in aliases.split(",") if a],
        "def": definition,
        "board": board,
    })

out = {
    "version": "2026-11",
    "note": "术语表：中文名 / 英文名 / 别名 / 一句话定义 / 所属板块。别名用于合并同义统计。",
    "sources": [
        "Vogue Runway 系列报道中的常用术语",
        "BoF、WWD 的行业表述",
        "品牌官网材质与工艺页",
        "中国服装协会流行趋势稿",
    ],
    "terms": rows,
}
with open(r"D:\chajian\data\corpus\terms.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)

from collections import Counter
c = Counter(r["board"] for r in rows)
print("terms:", len(rows), dict(c))
