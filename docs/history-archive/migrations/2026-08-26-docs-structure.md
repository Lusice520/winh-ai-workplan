# 2026-08-26：文档目录调整记录

## 目的

将业务需求、技术方案、开发测试和历史资料分开，减少抽象目录名和内部协作资料对正式文档入口的干扰。

## 迁移映射

| 原位置 | 新位置 | 说明 |
|---|---|---|
| docs/requirements/blueprints/ | docs/requirements/product-flows/ | 产品流程、业务流程和交互原型。 |
| docs/requirements/attachments/ | docs/requirements/references/ | 原始附件、外部参考和来源追溯资料。 |
| docs/requirements/issues/ | docs/development-testing/work-items/ | 开发任务与需求补充不再称为 issue。 |
| 新增 | docs/development-testing/issues/ | issues 专指 Bug。 |
| 新增 | docs/development-testing/test-cases/ | 测试用例。 |
| 新增 | docs/development-testing/accept/ | 验收材料与结论。 |
| docs/superpowers/specs/ | docs/history-archive/requirements/ | 历史兼容需求材料。 |
| docs/agents/ | .agents/ 和项目根目录 AGENTS.md | AI 协作规则与工作上下文不再放在 docs。 |
| docs/requirements/BUSINESS_BLUEPRINT.md | docs/history-archive/requirements/business-blueprint-redirect.md | 已由 BRD 替代的旧命名说明。 |

## 回滚边界

调整前的 docs 目录和 outputs/README.md 已保存在本地 .scratch/docs-layout-before-20260826.tar.gz 快照中。当前正式入口以 docs/README.md 为准。
