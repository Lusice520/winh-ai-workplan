# WI-010 交付基线、责任交接与范围变更本地验收记录

2026-09-13；负责人 Lusice / 实施与验证 当前 Codex。WI-010 的十项本地功能验收标准通过；非作者评审、MR、公司试用和生产交付尚未完成。整个系统目标继续。

DG-02 在原项目内完成团队、发布模板快照、阶段、里程碑、清单、工作包、计划、预算和九组检查；提交冻结当轮内容，独立会签及批准后原对象形成 V1，主阶段才由售前进入交付。批准后的预算修订 V2、独立确认的阶段范围 V3，以及成组范围 V4 均保留此前快照。审批、资源承诺和执行权限在命令生效时重新核验，人员被指定为责任人不等同于获得权限。

已验证真实责任交接：预览 8 项未结职责，新人接收，指定人重签 3 项资源，经理统一生效并明确回收原成员角色；原成员随后读取原项目与工作包返回 404。接任人完成原工作包，指定他人独立验证为 DONE；原需求不自动关闭，历史责任人与原始来源均保留。

新增范围以独立提案保存。浏览器首轮被退回，经理在原候选工作包补齐验收依据后重提，两项每天合计 6 小时的资源由指定人签认。独立批准后七个对象、两项资源及 499,000 元预算一次形成 V4，预留工作包 ID 进入真实执行入口。批准前继续执行 V3，不提前新增实际 Work 或占用正式资源；已完成包不被范围变更覆盖。取消的另一草案保留实际维护说明，不产生 V5。

| 验证 | 证据与结果 |
|---|---|
| 发布配置与权限分工 | [配置 API](../../../outputs/verification/wi-010-configuration/api-checks.json)、[浏览器读回](../../../outputs/verification/wi-010-configuration/browser-readback.json) |
| 立项与独立评审 | [准备](../../../outputs/verification/wi-010-delivery/prepare-checks.json)、[六组预检](../../../outputs/verification/wi-010-delivery/preflight-checks.json)、[浏览器闭环](../../../outputs/verification/wi-010-delivery/browser-readback.json) |
| 责任交接与原包执行 | [预检](../../../outputs/verification/wi-010-delivery/transfer-preflight.json)、[交接与执行读回](../../../outputs/verification/wi-010-delivery/transfer-readback.json)、[验证说明](../../../outputs/verification/wi-010-delivery/transfer-verification-notes.md) |
| 成组范围及重启读回 | [两轮与 V4 结果](../../../outputs/verification/wi-010-delivery/scope-readback.json)、[第一轮](../../../outputs/verification/wi-010-delivery/scope-round-1.json)、[第二轮](../../../outputs/verification/wi-010-delivery/scope-round-2.json)、[取消与说明隔离](../../../outputs/verification/wi-010-delivery/scope-audit-check.json) |
| 紧凑视觉与手机 | [校准](../../../outputs/design/wi-010/calibration-round-4/report/verification.json)、[桌面范围页](../../../outputs/verification/wi-010-delivery/desktop-scope-ready-v2.png)、[手机只读比较](../../../outputs/verification/wi-010-delivery/mobile-scope-review.png)、[对象修订](../../../outputs/verification/wi-010-delivery/mobile-object-history.png)、[新增工作包](../../../outputs/verification/wi-010-delivery/mobile-scope-approved-work.png)；截图实际查看，无页面横向溢出 |
| 自动检查与迁移 | 后端 49、前端 37 项及类型/Lint/格式/构建通过；实际全新空库 V1–V17 一次迁移、JPA 校验、主库重启读回通过，见 [最终记录](../../../outputs/verification/wi-010-delivery/final-verification-notes.md) |

事实来源：[WI-010](../work-items/WI-010-delivery-initiation-baseline.md)、[TC-010](../test-cases/TC-010-delivery-initiation-baseline.md)、PRD 4.13、DG2/TM/ST/MS/CL/WP/PL/BG 对应 SPEC 与 [业务共享契约](../../technical/designs/shared/BUSINESS_DELIVERY_CONTRACT.md)。新增后端 delivery、前端 delivery、V11–V17，扩展 Project/Work/Requirement 的受控协作接口和注册权限；原 Work 执行状态与基线状态分离。未修改已应用迁移，没有 commit、push 或部署。

金额、审批规则正文及可能含财务信息的修订/提案说明由服务端按权限投影。测试中公司初始批准权限来自明确隔离的合成账号夹具，实际其他人员通过正常 IAM 配置；应用没有新增“安全管理员任意授予业务权限”例外。公司授权责任分工及正式模板/阈值仍需业务试用确认。

本批待办是当前工作区派生提示，统一消息中心及可靠事件通知继续接续；阶段实际执行、清单到货安装验收、采购分包、经营预测/实际/报表、公司试用和生产条件不作为本批已完成内容。构建仍提示约 618 kB 的公共依赖块，功能验证不替代性能验收。
