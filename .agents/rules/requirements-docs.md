# 本项目需求与文档协作规则

本文件是 AI 协作规则，不属于正式项目文档；正式业务和产品事实始终以 docs/requirements/ 为准。

## 正式入口

- BRD：docs/requirements/BRD.md
- PRD：docs/requirements/PRD.md
- 产品流程与原型：docs/requirements/product-flows/index.html
- 参考资料：docs/requirements/references/
- 单功能 SPEC：docs/requirements/specs/
- 技术方案与 ADR：docs/technical/
- 开发、测试与验收：docs/development-testing/
- 历史资料：docs/history-archive/

## 文档边界

| 类型 | 标准位置 | 作用 |
|---|---|---|
| BRD | docs/requirements/BRD.md | 业务目标、生命周期、治理原则、边界与业务验收。 |
| PRD | docs/requirements/PRD.md | 产品方向、用户场景、范围、核心流程、功能清单和产品验收。 |
| SPEC | docs/requirements/specs/<feature_name>_spec.md | 单功能流程、页面、状态、字段、交互、异常、规则，以及接口、数据、实现、测试和验收设计。 |
| work-item | docs/development-testing/work-items/ | 开发任务、需求补充、依赖与完成检查。 |
| issue | docs/development-testing/issues/ | Bug 的复现、影响、修复与回归。 |
| test-case | docs/development-testing/test-cases/ | 可重复执行的测试用例。 |
| accept | docs/development-testing/accept/ | 验收范围、记录、证据和结论。 |

## 维护规则

1. 需求主线为 BRD → PRD → SPEC → work-item；Bug 不替代正常开发任务。
2. 下游资料不得静默扩大或改写上游已确认范围；范围变化先更新 BRD、PRD 或 SPEC。
3. 单功能 SPEC 直接放在 specs 目录，不建立“功能目录 / SPEC.md”的深层结构；新增时从 SPEC_TEMPLATE.md 开始。
4. 单功能详细设计与需求共同维护在对应 SPEC；只有跨功能复用约束进入 technical/designs，重大技术取舍进入 ADR，避免平行事实源。
5. 移动文件时必须更新相对链接，并验证引用、附件和产品流程页仍可访问。
6. outputs 只保存导出或阶段性交付副本；正式引用的资料进入 docs。
