# 多上下文领域文档导航

> 状态：已生效  
> 布局：前端与后端分开阅读，正式事实集中在 `docs/`  
> 关联入口：[CONTEXT-MAP.md](../../CONTEXT-MAP.md)

## 1. 原则

`CONTEXT-MAP.md`、`apps/web/CONTEXT.md` 和 `apps/backend/CONTEXT.md` 是阅读导航，不是新的需求、架构或规则事实源。它们只告诉实现者在开始工作前应读取哪些正式文件。

业务与产品事实始终在 `docs/requirements/`；总体技术基线、ADR 与共享设计始终在 `docs/technical/`；实施、测试、验收与任务状态始终在 `docs/development-testing/`。

## 2. 使用方式

1. 先读取根目录 [CONTEXT-MAP.md](../../CONTEXT-MAP.md)，确定本次涉及前端、后端或跨端契约。
2. 前端工作再读取 [apps/web/CONTEXT.md](../../apps/web/CONTEXT.md)；后端、数据库、认证或 Worker 工作再读取 [apps/backend/CONTEXT.md](../../apps/backend/CONTEXT.md)。
3. 按 work-item 再读取对应 SPEC、ADR、共享设计和测试事实；发生冲突时，以项目 `AGENTS.md` 规定的正式来源为准。
4. 需要新增或澄清领域词汇、实体关系或不可逆决策时，使用 `domain-modeling` 并将结论写入正确的 SPEC、共享设计或 ADR，不写入本导航文件代替正式事实。

## 3. ADR 位置

本项目的系统级 ADR 位于 `docs/technical/adr/`，而不是通用模板中的 `docs/adr/`。前端和后端 Context 都会显式链接相关 ADR；任何与已接受 ADR 冲突的方案必须先外显并按项目规则复审。
