# WI-010 最终本地验证说明

时间：2026-09-13（Asia/Shanghai）；数据均为标有“验证·”的本地合成项目与账号。正式范围与结论见 docs/development-testing/accept/ACCEPT-010-delivery-baseline-local.md。

- 最终后端全套 49 项，Failures 0 / Errors 0 / Skipped 0，BUILD SUCCESS；原始日志 `.local-data/wi010-delivery-final-backend.log`。
- 最终前端 14 个文件、37 项测试，类型/Lint/格式/构建通过；原始日志 `.local-data/wi010-delivery-final-web.log`。仅末次空轮次提示文字修改后另行类型与构建检查。
- 空库 `winh_wi010_scope_clean_20260913` 启动前 public 用户表为 0；07:59:38 Flyway 明确报告一次成功应用 17 migrations，随后 JPA 校验与应用启动成功。主库与该空库 read-only 查询均返回成功记录数 17、bool_and(success)=true、最大 installed_rank=17；主库 8080 与空库 8082 健康检查均 HTTP 200 / UP。
- 主库最新代码重启后，08:02 的 `scope-readback.json` 记录确认有效 V4、499,000 元预算、两项新增资源/工作包及已完成原包持久；V1–V3、两轮提案、原需求和责任交接保持原事实。
- `scope-audit-check.json` 验证实际新建/取消两条说明、命令重放不重复、普通参与者无敏感说明，以及取消草案不改变 V4。V17 以前不存在的操作事件未回填或伪造。
- 服务集成测试真实保存交付实体、快照、审计与幂等记录，部分外部模块以受控替身隔离；真实 PostgreSQL、多账号与浏览器场景另列，二者不互相替代。
- 最终截图已实际查看；范围内容桌面双列、手机单列。手机前后对照只读，对象修订抽屉 7 条历史、零编辑字段。说明历史可展开实际操作者及原说明。390px 页面无横向溢出。
- 校准 round-4 九处独立测量最大外框偏差 10 CSS px；错误路由 round-3 和修复前的旧截图仅作过程记录。签认容量 5 小时的 409 是刻意负例；后续 8 小时签认通过。服务重启间的连接失败与正常控制台结果分开记录。

本地检查不包含非作者代码评审、公司真实制度/账号试用、生产部署、性能或统一消息投递验收。测试会话、凭据与运行库留在忽略目录中，不进入本证据文档。
