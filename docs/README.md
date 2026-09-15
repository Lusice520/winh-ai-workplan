# 项目文档总入口

本目录是“项目全生命周期管理系统”的正式文档入口。目录按业务与产品需求、技术方案、开发与测试、历史资料四类划分；当前有效结论以 requirements 和 technical 中标注为“当前正式”的文档为准。

返回：[项目总入口](../README.md)

## 目录与中文含义

| 目录 | 中文含义 | 主要回答的问题 |
|---|---|---|
| [requirements](./requirements/README.md) | 业务与产品需求 | 为什么做、做什么、范围和验收是什么 |
| [technical](./technical/README.md) | 技术方案与设计 | 系统怎样实现、关键技术选择为何如此 |
| [development-testing](./development-testing/README.md) | 开发、测试与验收 | 谁来做、如何测试、如何验收 |
| [history-archive](./history-archive/README.md) | 历史资料归档 | 哪些资料已被替代但仍需追溯 |

## 文档主线

BRD → PRD → 单功能 SPEC（含功能详细设计）→ work-items → test-cases → accept

总体技术方案、ADR 和跨功能共享设计由 BRD、PRD、SPEC 派生，为实施提供约束；它们不能静默改写已确认的业务和产品事实。单功能的页面、接口、数据、权限、异常、实现与验证设计统一维护在对应 SPEC，不再建立平行 DES。开发过程中发现的缺陷统一进入 issues，并关联对应的 SPEC 或 work-item。

## 命名与使用约定

1. 目录使用简明小写英文和连字符，例如 work-items；正式文档类型保留 BRD、PRD、SPEC、ADR 等通用缩写。
2. 文档标题、正文和目录说明使用中文；链接优先使用相对路径。
3. 业务与产品事实只在 requirements 维护；技术实现事实只在 technical 维护；开发执行、测试和验收资料只在 development-testing 维护。
4. history-archive 中的文档用于追溯，不是当前开发依据。
5. outputs 位于 docs 之外，只保存导出物和阶段性交付副本，不是正式事实来源。

项目级 AI 入口、团队开发流程、工具适配、自动化 Hook 和脚本不放在 docs 中：分别从项目根目录的 AGENTS.md、CONTRIBUTING.md、CLAUDE.md、.trae/、.agents/、.githooks/ 和 scripts/ 管理。
