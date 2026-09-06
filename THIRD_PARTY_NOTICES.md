# 经光第三方资料来源

经光只复用许可允许的代码/数据，并保留来源与署名。受限制译本或资料不得直接提交到公开仓库。

## ChineseBibleSearchJS
- Source: https://github.com/xuan9/ChineseBibleSearchJS
- Code license: MIT
- Usage: 中文经文引用解析/搜索逻辑参考与 vendored parser。

## midvash/bible-data
- Source: https://github.com/midvash/bible-data
- Usage: 中文和合本简体/繁体按书卷读取。
- Licensing: 每个译本依其 metadata；当前 cuv/cuvs 标示为 public-domain。

## OpenBible.info cross references / NEUU unified dataset
- Source: https://www.openbible.info/labs/cross-references/
- Adapter source: https://github.com/neuu-org/bible-crossrefs-dataset
- OpenBible license: CC BY
- Consolidated NEUU dataset/scripts: CC BY 4.0; TSK source component is public domain.
- Usage: 经光按单节经文加载串珠，避免一次下载整个大型数据集。
- Attribution: Cross-reference data courtesy of OpenBible.info, licensed under a Creative Commons Attribution license.

## Concord
- Source: https://github.com/kbennett2000/concord
- Code license: MIT
- Relevant datasets: OpenBible cross-references; SBLGNT/OSHB/STEPBible original-language and Strong data under their documented licenses.
- Usage: 作为经光后续原文、Strong、全文/语义检索后端实现参考。未整体复制 Concord 数据库。

## Verbum
- Source: https://github.com/DavidKGBR/verbum
- Code license: MIT
- Relevant capabilities: multiple translations, 344K cross-references, Greek/Hebrew interlinear, Strong lexicon, study API.
- Usage: API/数据模型参考。任何具体第三方数据在复制前仍需按该数据自身许可核对。

## 经光规则
1. 圣经是第一层资料。
2. 预言之灵原始资料必须保存可核验出处。
3. AI 只整理已核验资料，不作为原始出处。
4. 所有第三方数据保留来源、许可和必要署名。
5. 不把版权受限译本或 EGW 全文未经授权镜像进公开仓库。
