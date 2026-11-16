# data 目录说明

仓库里的数据分三类。**上传 GitHub 时只提交前两类，第三类不入库。**

## 1. 示例数据（合成，可提交）

| 文件 | 用途 |
|---|---|
| `evidence.sample.json` | 31 条合成证据，跑 `pnpm demo` 用 |
| `claims.json` | 示例命题 |
| `sources.json` | 示例来源 |

域名都用 `*.example`，不对应任何真实网站。

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
