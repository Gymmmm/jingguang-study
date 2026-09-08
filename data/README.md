# 经光数据层

本目录是经光 V10+ 的正式数据源。前端不得重新把 Bible→EGW 关系或 EGW 记录写死在 `index.html`。

圣经运行时正文位于 `data/bible/`，关键词搜索使用构建生成的
`data/bible-search.json`。上游来源和公有领域许可仍记录在
`bible-source.json`，用户端不依赖 GitHub Raw 才能打开或搜索经文。

## 1. `egw-index.json`

每条预言之灵记录必须是可核验的结构化出处。当前中文索引最低字段：

```json
{
  "id": "DA-29-SABBATH",
  "author": "Ellen G. White",
  "title": "The Desire of Ages",
  "title_cn": "历代愿望",
  "book_code": "DA",
  "chapter": "第29章 安息日",
  "locator": "DAL 1.911–1.915",
  "language": "zh",
  "source_type": "official_locator",
  "source_url": "https://m.egwwritings.org/...",
  "bible_refs": ["创世记2:3", "出埃及记20:11"],
  "topics": ["安息日", "创造"],
  "summary": "研究入口摘要，不冒充怀爱伦原文。"
}
```

规则：

- `id` 永久稳定，不能复用。
- `source_url` 优先使用 EGW Writings 官方来源。
- `summary` 只能是研究摘要，不能伪装成原文引语。
- 没有可核验出处的内容不要加入正式索引。
- 未获得授权的批量中文全文不要直接镜像进仓库。

## 2. `bible-egw-relations.json`

这是圣经到预言之灵的显式关系层，而不是普通关键词表。

```json
{
  "bible_ref": "但以理书8:14",
  "normalized": "Dan 8:14",
  "themes": ["二千三百日", "圣所", "审判", "1844"],
  "related_bible": ["但以理书7:9-10", "但以理书9:24-27"],
  "egw_ids": ["CIHS-2300", "EW-VISIONS"]
}
```

规则：

- `egw_ids` 必须引用 `egw-index.json` 中真实存在的 ID。
- 精确经文关系优先于主题猜测。
- `related_bible` 是研经导航，不代表所有神学关系都已穷尽。

## 3. `sermon-project-schema.json`

来源层级固定：

1. 圣经 `bible` — primary
2. 预言之灵 `egw` — supporting verified source
3. 我的研究 `note` — user authored
4. AI整理 `ai` — derived only, never quote as source

任何 AI 功能只能整理已经进入项目的资料，不能生成并冒充圣经或怀爱伦原文。

## 数据变更检查

每次修改 `data/**`，GitHub Actions 会运行：

```bash
node scripts/validate-data.mjs
```

检查：必填字段、重复 ID、无效 EGW 关系引用、来源层级、讲章 schema 基础字段。
