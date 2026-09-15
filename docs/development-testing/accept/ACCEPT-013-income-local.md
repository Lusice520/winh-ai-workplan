# WI-013 经营预测与收入本地验收

2026-09-13；负责人 Lusice，实施与验证 Codex。本批经营预测与收入能力的本地验收通过，整个系统继续实施。

项目“资金计划”保留原实施预算，并增加经营预测与收入入口。财务岗位维护月度预测、逐版比较并明确发布；PMO 记录已发生收入，指定其他营销人员独立确认或退回。上传资料和保存预测都不会自动确认收入。已确认错误通过单独整笔冲销留痕，原收入和旧预测/旧文件依据保留，月份及币种分别汇总。

真实合成项目 CNY 九月有六条收入记录，已发布计划 1,200,000.00、确认净额 850,000.00、待确认正向收入 150,000.00；八月原收入 50,000.00 没有被九月冲销改写。USD 两个冲销并发确认只有一次生效，后续独立收入及正式责任交接后净额 45.00。EUR 通过真实桌面录入和手机两轮处理，确认收入 123.45；临时预测草案放弃后计划仍为 100.01。

| 验证 | 证据 |
|---|---|
| 预测发布、两轮原始依据、整笔冲销 | [最终事实](../../../outputs/verification/wi-013-income/final.json)、[人民币流程](../../../outputs/verification/wi-013-income/cny-business-flow.json)、[资料版本](../../../outputs/verification/wi-013-income/files.json) |
| 手机实际填报与独立确认 | [第二轮提交](../../../outputs/verification/wi-013-income/browser-mobile-resubmit.log)、[独立确认](../../../outputs/verification/wi-013-income/browser-mobile-confirm.json)、[确认页](../../../outputs/verification/wi-013-income/mobile-confirmed.png) |
| 权限、责任交接、并发与草案保护 | [反例及并发](../../../outputs/verification/wi-013-income/negative-concurrency.json)、[正式交接](../../../outputs/verification/wi-013-income/handoff.json)、[保留输入](../../../outputs/verification/wi-013-income/browser-conflict.json)、[弃版](../../../outputs/verification/wi-013-income/browser-discard.json) |
| 真实迁移与重启原字节 | [回读](../../../outputs/verification/wi-013-income/restart-readback.json)、[数据库约束](../../../outputs/verification/wi-013-income/database-constraints.log)、[升级及空库迁移](../../../outputs/verification/wi-013-income/migrations.json) |
| 页面及原预算入口 | [桌面](../../../outputs/verification/wi-013-income/desktop-final.png)、[390px](../../../outputs/verification/wi-013-income/mobile-workspace-final.png)、[资金入口](../../../outputs/verification/wi-013-income/project-funds-entry.png)、[最终浏览器检查](../../../outputs/verification/wi-013-income/browser-final.json)、[筛选保留](../../../outputs/verification/wi-013-income/browser-filter-final.json) |
| 设计校准 | [设计稿 V2](../../../outputs/design/wi-013/income-design-v2.png)、[六区域实测](../../../outputs/design/wi-013/calibration-03/report/verification.json)、[采集与取舍](../../../outputs/design/wi-013/calibration-03/round-notes.md) |

后端 69 项全量、前端 49 项 / 17 文件、类型、Lint、格式和构建通过。V21 增加四类表及四项权限定义，无默认公司角色授权；真实验证另经显式本地合成角色配给。IncomeStore 为不代理协作者，命令服务负责事务；项目锁统一保护版本、历史、幂等、责任交接与冲销唯一性。ContractDirectory 仅扩展公开收入来源查询，当前受限合同不会阻断其他可读经营事实；历史来源保持当时版本，并按当前权限隐藏受限内容。

桌面 1523×1033 内可看到六条台账和三版预测，完整说明在详情保留。390px 先显示待办、长表内部滚动。连续筛选丢失字段和详情跨列警告已修复并复验。校准第二轮因全页截图 1514px 与声明 1523px 不一致判失败，第三轮明确改为视口采集后通过身份前提；未将几何偏差冒充还原百分比。实际最终截图另行复核。保留公共依赖块约 584 kB 的构建提示。

本项目当前没有归档合同，收入使用明确的项目其他依据；签署合同来源检查有集成覆盖，不宣称本例有真实合同。重启核对原任务/执行/批准范围和四个文件版本原字节均通过。正式会计/税务、汇率、现金回款、发票、付款和采购实际不由收入确认替代；回款/开票、付款/采购/分包、汇总报表及其他系统域继续接续。生产基础设施、公司授权试点与正式部署尚未完成。

关联 [INC-01](../../requirements/specs/income_forecast_spec.md)、[WI-013](../work-items/WI-013-income-forecast.md)、[TC-013](../test-cases/TC-013-income-forecast.md)、[共享契约](../../technical/designs/shared/BUSINESS_DELIVERY_CONTRACT.md)。无 commit/push/MR/部署。
