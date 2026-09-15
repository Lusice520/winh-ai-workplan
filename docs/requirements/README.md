# 业务与产品需求

本目录是本项目业务和产品事实的正式入口，回答“为什么做、做什么、做到什么边界”。BRD、PRD、单功能 SPEC、产品流程和参考资料按层级管理，避免同一事实散落在多个位置。

## 当前正式文档

- [业务需求文档（BRD）V0.4](./BRD.md)：当前业务需求基线。
- [产品需求文档（PRD）V0.4](./PRD.md)：当前 P1/P2 产品基线及 P3/P4 后续边界。
- [业务需求蓝图导航](./product-flows/index.html)：流程与图形化产品资料。
- [项目规定动作与成果物主清单 V0.1](./references/项目规定动作与成果物主清单_v0.1.xlsx)：原始盘点与来源追溯，不直接构成 V0.4 当前执行基线。

本地已进入实施的业务 SPEC：

- CRM：[客户主档](./specs/customer_master_spec.md)、[商机主档](./specs/opportunity_master_spec.md)、[商机结果](./specs/opportunity_result_spec.md)。
- 售前：[项目空间](./specs/project_space_spec.md)、[投入立项](./specs/presales_initiation_spec.md)、[规定动作与成果](./specs/presales_actions_spec.md)。
- 需求：[需求池](./specs/requirement_pool_spec.md)、[处理与验证](./specs/requirement_resolution_spec.md)。
- 接续：[合同归档与节点历史](./specs/contract_archive_spec.md)、[项目资料](./specs/project_files_spec.md)、[DG-01 移交](./specs/dg01_handover_spec.md)、[提前开工](./specs/early_start_spec.md)。

这些是分批实现的明细，不代表 PRD 中所有后续功能已经交付。

## 分层与标准路径

| 层级 | 标准路径 | 职责 |
|---|---|---|
| BRD | docs/requirements/BRD.md | 业务目标、生命周期、治理规则、业务边界和阶段验收。 |
| PRD | docs/requirements/PRD.md | 产品定位、用户场景、范围、核心流程、功能清单、SPEC 管理总清单和产品级验收。 |
| 单功能 SPEC | docs/requirements/specs/<feature_name>_spec.md | 页面、字段、状态、交互、异常、业务规则，以及该功能的接口、数据、实现、测试和验收设计。 |
| 产品流程 | docs/requirements/product-flows/ | 流程图、页面流转和交互原型。 |
| 参考资料 | docs/requirements/references/ | 原始附件、外部参考和来源追溯资料。 |

## 与开发和测试资料的边界

- 开发任务、需求补充和实施拆分进入 [development-testing/work-items](../development-testing/work-items/README.md)。
- Bug 进入 [development-testing/issues](../development-testing/issues/README.md)，不再作为需求目录中的 issue。
- 测试用例进入 [development-testing/test-cases](../development-testing/test-cases/README.md)，验收材料进入 [development-testing/accept](../development-testing/accept/README.md)。
- 总体技术方案、ADR 和跨功能共享设计进入 [technical](../technical/README.md)，不能反向静默修改需求事实；单功能详细设计留在对应 SPEC。

## 使用规则

1. 新增或修订的业务和产品事实统一进入本目录；历史文档只在 history-archive 中追溯。
2. 下游发现范围不足或冲突时，先修订并确认 BRD、PRD 或对应 SPEC，不得在 work-item、Bug 或技术设计中静默改写需求。
3. PRD 保持产品级范围和流程；字段、按钮、提示文案、状态、异常、接口、数据、实现和测试设计进入对应 SPEC。
4. 新增 SPEC 直接放在 specs 目录，不建立“功能目录 / SPEC.md”的深层结构；可从 [SPEC 模板](./specs/SPEC_TEMPLATE.md)开始。
5. outputs 不属于需求事实目录；被正式引用的附件进入 references。
