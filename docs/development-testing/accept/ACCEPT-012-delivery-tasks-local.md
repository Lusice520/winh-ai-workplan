# WI-012 原工作包任务本地验收

2026-09-13；负责人 Lusice，实施与验证 Codex。本批任务能力的本地验收通过，整个系统继续实施。

在原批准工作包下可以新建个人任务，或原位接纳需求池已经派生的任务。负责人登记计划、实际进展与成果，指定其他人独立验证或退回；旧轮文本、文件版本与责任都保留。当前范围变化须明确复核，未结或需复核任务会阻止父包完成。取消与重开各自留痕，取消数量从有效完成分母中排除。

实际合成项目有 7 条任务记录：有效 6、已独立完成 2、待验证 1、取消 1。原需求任务两轮提交，第一轮报告缺项被退回，第二轮补齐并独立通过；原需求仍处于自己的处理流程。V4 批准范围、阶段/设备数量/里程碑实际、既有 DONE 工作包都与本批开始时一致。

| 验证 | 证据 |
|---|---|
| 原位接纳、真实新建、两轮原文件 | [最终记录](../../../outputs/verification/wi-012-tasks/final.json)、[手机新建](../../../outputs/verification/wi-012-tasks/browser-mobile-create.json)、[文件原版本](../../../outputs/verification/wi-012-tasks/files.json) |
| 权限、日期、父包完成门、并发与重放 | [反例](../../../outputs/verification/wi-012-tasks/negative-checks.json)、[并发检查](../../../outputs/verification/wi-012-tasks/checks.json)、[取消重开](../../../outputs/verification/wi-012-tasks/browser-cancellation.json) |
| 真库迁移、原字节与重启 | [回读记录](../../../outputs/verification/wi-012-tasks/restart-readback.json)、[来源约束](../../../outputs/verification/wi-012-tasks/postgres-source-check.txt)、[本地监听](../../../outputs/verification/wi-012-tasks/local-storage-listeners.txt) |
| 自动检查 | 后端全量 61 项及最后关联 9 项；前端最终 43 项 / 16 文件、类型、Lint、格式、构建通过 |
| 实际页面 | [桌面任务列表](../../../outputs/verification/wi-012-tasks/desktop-task-list.png)、[手机核验](../../../outputs/verification/wi-012-tasks/mobile-review-viewport-final.png)、[手机任务](../../../outputs/verification/wi-012-tasks/mobile-task-viewport-final.png)、[手机验证结果](../../../outputs/verification/wi-012-tasks/browser-mobile-final.json) |
| 设计与校准 | [设计稿](../../../outputs/design/wi-012/task-workspace-design-v1.png)、[五区域采集](../../../outputs/design/wi-012/calibration-02/report/verification.json)、[设计取舍](../../../outputs/design/wi-012/calibration-02/round-notes.md) |

Work 内新增任务正文/事件和受控接口，Execution 提供只读阶段目录，Project 责任交接继续覆盖原任务。V19 和 V20 只向前追加，V20 专门修复真实 PostgreSQL 暴露的旧来源约束问题。H2 领域集成使用部分来源/IAM/文件替身，真实多账号浏览器、PostgreSQL 和私有文件字节验证另外完成，不能相互代替。

本机启动入口固定合成存储连接，修正 S3Mock 额外 HTTP connector 的监听范围，实测两个端口均仅本机；生产存储仍按原技术基线单独交付。构建保留约 584 kB 公共依赖块提示。周计划/实际投入、报告例会、统一消息、采购分包与经营财务、公司试用和正式部署继续接续，不属于本批完成结论。

事实来源：[TASK-01](../../requirements/specs/delivery_task_spec.md)、[WI-012](../work-items/WI-012-delivery-tasks.md)、[TC-012](../test-cases/TC-012-delivery-tasks.md) 与 [共享契约](../../technical/designs/shared/BUSINESS_DELIVERY_CONTRACT.md)。无 commit/push/MR/部署。
