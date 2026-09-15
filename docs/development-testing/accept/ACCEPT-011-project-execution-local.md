# WI-011 原项目执行事实本地验收

2026-09-13；负责人 Lusice，实施与验证 Codex。阶段、清单与里程碑执行的本地功能验收通过；公司试用、非作者评审与生产交付继续。

在原项目 V4 批准范围下，已完成阶段开始、进展、暂停/恢复、完成与明确重开；清单按适用环节分批登记到货、安装与独立验收，错误事实通过整条冲回保留历史；里程碑由指定他人核验，并记录各轮原依据与附件版本。当前范围变化会使受影响结果需要重新核验，不能用原结论表示新范围已经完成。

本次合成项目结果：方案设计已完成，采购集成进行中，其他两阶段未开始。批准的 8 套设备净到货 8、净安装 4、独立验收 2、待核验 1；验收比例为 25%，阶段报告进度为 55%，两者分别表达。原 V4 对象、此前已完成工作包及原需求身份未改变。

| 验证 | 证据 |
|---|---|
| 准入、原对象、项目隔离 | [预检](../../../outputs/verification/wi-011-execution/preflight.json)、[原数据](../../../outputs/verification/wi-011-execution/before.json) |
| 分批、并发、重放、冲回与暂停 | [真实接口验证](../../../outputs/verification/wi-011-execution/quantity-checks.json)、[最终清单](../../../outputs/verification/wi-011-execution/final-equipment.json) |
| 阶段、里程碑与两轮历史 | [完成与重开](../../../outputs/verification/wi-011-execution/finish-checks.json)、[原附件历史](../../../outputs/verification/wi-011-execution/milestone-history.json) |
| 主库重启与新库迁移 | [读回记录](../../../outputs/verification/wi-011-execution/restart-readback.json)：零表至 V18；主库与新库 18 条迁移成功，健康检查均 UP |
| 自动检查 | 后端 55 项与前端 40 项 / 15 文件通过，类型、Lint、格式、构建通过；最后抽屉密度样式调整另通过构建与实屏查看 |
| 实际浏览器 | 经理开始/提交、负责人提交数量、其他指定人核验；[手机核验](../../../outputs/verification/wi-011-execution/mobile-independent-review-form.png)、[本人队列](../../../outputs/verification/wi-011-execution/mobile-review-queue-final.png)、[只读历史](../../../outputs/verification/wi-011-execution/desktop-milestone-history-final.png) |
| 设计与校准 | [设计稿](../../../outputs/design/wi-011/project-execution-design-v1.png)、[有效测量](../../../outputs/design/wi-011/calibration-03/report/verification.json)、[当前桌面](../../../outputs/verification/wi-011-execution/desktop-execution-v3.png)、[手机清单](../../../outputs/verification/wi-011-execution/mobile-item-summary-v2.png) |

设计沿用既有项目导航与权限可见入口，主列保留计划/实际对照及原工作包，侧栏显示本人待核验与近期记录。首屏仅列最近三条记录，其他记录按需打开；筛选折叠，长表局部滚动，390px 先显示本人待核验。七个测量区域和页面身份通过，桌面及手机截图已实际查看。参考图为信息编排依据，实际数据、固定导航、完整责任名称及范围条件使区块高度与图不同，不以几何偏差宣称“还原率”。

事实来源：[WI-011](../work-items/WI-011-project-execution-facts.md)、[TC-011](../test-cases/TC-011-project-execution-facts.md)、[EXEC-01](../../requirements/specs/project_execution_spec.md)、ST/MS/CL/WP 与 [共享契约](../../technical/designs/shared/BUSINESS_DELIVERY_CONTRACT.md)。新增执行模块及 V18，扩展 Delivery 非财务公开目录/事务内事件、Work 行为校验和 Project 职责交接。原已应用迁移、批准快照与独立完成记录保留，无 commit/push/MR/部署。

执行单测采用真实执行存储、审计和幂等，部分来源/IAM 由受控替身提供；实质范围变更使结果失效和执行验证人交接由集成验证，未宣称进行新的公司审批试点。真实 PostgreSQL 并发、跨账号页面和重启另行验证。构建仍提示约 618 kB 公共依赖块，正式规模与性能另验。公司验收模板、统一消息、任务/周计划/工时、报告例会、采购分包和经营财务继续接续，整个系统目标保持进行中。
