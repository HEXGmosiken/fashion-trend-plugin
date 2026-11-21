# data 目录说明

仓库里的数据分三类。**上传 GitHub 时只提交前两类，第三类不入库。**

## 1. 示例数据（合成，可提交）

| 文件 | 用途 |
|---|---|
| `evidence.sample.json` | 31 条合成证据，跑 `pnpm demo` 用 |
| `claims.json` | 示例命题 |
| `claims.template.json` | 可复制的双窗命题模板 |
| `sources.json` | 示例来源 |

域名都用 `*.example`，不对应任何真实网站。

复制 `claims.template.json` 后，按研究设计填写问题、信号、分析单位、两个时间窗、每窗最小样本量及编码规则。日期边界均包含当天，主题季可以区分日期重叠的窗口。`signal` 对应证据的 `codings` 键。明确判定的样本写 `true` 或 `false`，无法判定时省略该键。每个分析单位保留一条规范证据。程序检查结构化的品牌、来源类型、日期和季节，`include`、`exclude` 里的文字条件由编码员逐条复核。

```bash
pnpm exec node src/cli/index.ts validate --input data/evidence.sample.json --claims data/claims.template.json
pnpm analyze --input data/my-evidence.json --claims data/claims.template.json --sources data/my-sources.json
```

## 2. 项目自有内容（可提交）

| 文件 | 说明 |
|---|---|
| `corpus/terms.json` | 204 条术语表，自写定义 |
| `corpus/patterns.json` | 30 条句式模板 |
| `corpus/summary.json` | 总述论点，人工撰写 |
| `taxonomy.json` | 六个板块定义 |
| `trends.source.json` | 十二条人工趋势的原始描述 |
| `sources.real.json` | 27 个来源的元数据（无正文） |
| `claims.real.json` | 3 条命题与编码规则（无正文） |
| `images.manifest.json` | 配图清单（只有 URL 和尺寸，不含图片） |

## 3. 版权受限（不入库）

| 文件 | 为什么不提交 |
|---|---|
| `articles.real.json` | 50 篇文章全文 |
| `evidence.real.json` | 含原文摘录 |
| `trends.json` | 由全文生成的引用 |
| `external/` | 26 篇外部媒体全文 |
| `../assets/img/` | 41 张媒体报道图片 |
| `../foreign.md`、`../local.md` | 文章全文的 markdown 备份 |

这些是研究用的本地语料，版权属于原媒体。仓库里只保留代码、术语、句式和元数据。

### 本地重新生成

```bash
# 1. 把文章按 README 的格式放到 data/articles.real.json
# 2. 抓配图（可选）
python _tools/images.py

# 3. 生成趋势与报告
pnpm ingest
```

没有全文语料时，`pnpm demo` 仍然可以跑通全链路。

---

## 4. 术语表 v2 字段（2026-11 起）

`corpus/terms.json` 的每条术语，基础字段是
`zh / en / aliases / def / board`，v2 起新增三个字段：

| 字段 | 含义 | 例 |
|---|---|---|
| `parent` | 上位类，用于聚合分析 | 插肩 → 袖型 |
| `criterion` | 判据：看到什么才这么标 | 肩部无横缝、拼接线从领口斜到下腋 |
| `confusable` | 易混词与区别 | 落肩：肩线整体横向下移，仍有横缝 |

写法约定见 `docs/术语表v2提案.md` 第八节。检查脚本：

```bash
node _tools/audit_terms.mjs        # 重复、缺字段、定义长度
node _tools/check_criteria.mjs     # 判据质量：空泛词、循环定义、易混词缺失
```

## 5. 语料入库（不爬虫）

正文由人工保存，脚本只做整理入库，不访问网络。

```
data/external/inbox/
  manifest.csv       file,source,url,date
  0001.html          浏览器另存的页面，或
  0002.txt           复制下来的纯文本
```

```bash
python _tools/ingest_local.py                    # 读 inbox，写 articles.json
python _tools/ingest_local.py --min-chars 600    # 提高正文长度门槛
python _tools/ingest_local.py --check data/external/articles.json
```

输出 `data/external/articles.json`，字段与 `_tools/fetch_external.py` 一致：
`source / url / title / date / chars / text / ok`。

去重规则：同一 URL 只取第一条；正文前 400 字归一后做指纹，重复的丢弃。

**入库边界**：`articles.json` 含全文，属版权受限内容，**不进仓库**；
仓库里只放 `sources.real.json`（元数据）与 `claims.real.json`（命题）。
