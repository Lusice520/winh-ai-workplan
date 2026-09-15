# TC-013：经营预测与收入确认

2026-09-13；Owner Lusice；对应 [INC-01](../../requirements/specs/income_forecast_spec.md)、[WI-013](../work-items/WI-013-income-forecast.md)。本地合成账号按独立项目角色授予权限；金额、客户和资料均为验证数据。

| 组 | 用例与验收结果 | 证据 |
|---|---|---|
| INC-01-A 预测版本 | 初版草案不计计划；发布 V1 后生效；原节点身份延续 V2/V3。旧收入仍引用原 V1。EUR 草案 175.01 放弃后仍使用 V1 的 100.01，弃版历史保留。引用待确认记录不自动填写金额或发布。 | `cny-business-flow.json`、`browser-discard.json`、IncomeIntegrationTest |
| INC-01-B 独立确认 | PMO 填报、指定营销确认；首轮退回后补充文字/文件，第二轮提交再确认。EUR 桌面录入、390px 手机退回/修改/重提/确认实际成功。三位小数提示错误并保留输入。 | `browser-mobile-confirm.json`、`browser-mobile-resubmit.log`、`files.json` |
| INC-01-C 冲销与期间 | 原 8 月 CNY 收入 50,000 保留，9 月整笔冲销记负向；原确认事实不可编辑。两个 USD 冲销同时确认，一次成功、一次 409，不能重复冲销同一原收入。 | `negative-concurrency.json`、`database-constraints.log` |
| INC-01-D 汇总与来源 | CNY 9 月计划 1,200,000、确认净额 850,000、待确认 150,000；USD 净额 45.00、EUR 净额 123.45 独立计算。关键词、日期起止和分页保存在 URL，连续变化不丢失其他筛选；筛选后汇总仍为全月口径。 | `final.json`、`browser-filter-final.json`、前端连续筛选回归 |
| INC-01-E 权限及责任 | 提交人与确认人不得同人；未指定人/越权写入拒绝，项目外及已移除成员读不到记录。来源/历史附件按当前权利投影。营销责任通过原 DG-02 交接预览、接任接收、负责人使其生效；旧提交人不变、原确认人失去确认资格。 | `handoff.json`、`negative-concurrency.json`、IncomeIntegrationTest |
| INC-01-F 并发及失败 | 草案并发保存仅一份成功；旧窗口保存返回 409 且保留金额 150.01 和原因。精度、上限、未来实际日期、币种、跨项目/原预测来源、不合规资料失败均不产生残留事实。数据库单册唯一、同册版本外键、正金额、独立确认、单次已确认冲销实测生效。 | `browser-conflict.json`、`negative-concurrency.json`、`database-constraints.log` |
| INC-01-G 持久化与回归 | V20→V21 和零表→V21 均成功；重启后端及 S3 后五个月份币种窗口、所有收入/预测/历史 JSON、四个收入/任务资料版本原字节一致；11 个旧工作项、7 个任务正文、原执行与批准范围、来源需求不变。桌面/390px 无页面横向溢出。 | `restart-readback.json`、`browser-final.json`、最终桌面/手机截图 |

证据目录：[WI-013 实际验证](../../../outputs/verification/wi-013-income/)。自动检查：后端 69 项全量通过；前端 49 项 / 17 文件、类型、Lint、格式和构建通过。H2 集成中的部分 IAM/合同/文件用替身隔离，PostgreSQL、S3 和多账号真实流程另外验证。当前合成项目没有归档合同，真实浏览器使用明确的项目其他收入依据；合同归档/签署资料受限分支由关联集成用例验证，不能表述为本项目已签约。

执行工具出现的采集前提错误保留在日志：旧定位器在抽屉关闭后匹配到下层抽屉、等待了错误文本、预算异步加载未完成、移动尺寸切换未稳定，以及全页截图宽度与元数据不一致。修正后重新采集和断言；这些失败记录不作为通过证据。正式结论见 [ACCEPT-013](../accept/ACCEPT-013-income-local.md)。
