# Backend 与数据上下文

> 适用范围：`apps/backend/` 的 Spring Boot Module、认证、授权、HTTP、PostgreSQL、Flyway、Worker 和后端测试。  
> 正式事实入口：[项目上下文导航](../../CONTEXT-MAP.md)

## 开始前读取

1. 对应 work-item、PRD/SPEC，以及其中的接口、数据、事务、安全和测试章节。
2. [总体技术方案](../../docs/technical/TECHNICAL_SOLUTION.md)、[ADR-001](../../docs/technical/adr/ADR-001-application-runtime-shape.md)、[ADR-003](../../docs/technical/adr/ADR-003-relational-data-transaction-and-cache.md)、[ADR-005](../../docs/technical/adr/ADR-005-local-identity-authentication-and-session.md) 与 [ADR-006](../../docs/technical/adr/ADR-006-reliable-business-events-and-jobs.md)。
3. 对应的共享设计、OpenAPI/错误契约、数据库迁移规则和安全设计；它们未冻结时先补齐正式设计，不以默认实现代替决策。

## 约束

- P1 是模块化单体加独立 Worker。每个 Module 通过公开 Interface 协作，不能跨 Module 直接读写其 Repository 或业务表。
- 数据库迁移随 `apps/backend/` 版本维护；已合并迁移不可改写，安全、并发、幂等和审计要求必须随业务实现和测试一起交付。
- 控制器只处理 HTTP Adapter 职责；业务事务、授权复核和领域规则归属相应 Module，不能散落在 Controller 或 SQL 脚本中。
- 身份、会话、权限、审计和外部 Adapter 是高风险边界；没有对应 SPEC、共享设计与安全测试，不得以开发便利绕过。
- 后端变更至少运行相关 Maven 测试；涉及迁移、认证或跨端流程时补充 PostgreSQL 集成测试与端到端证据。

## 当前业务入口

- `crm/project/presales/requirements/work`：WI-008 的客户商机、同一项目空间、售前、需求处理和验证闭环。
- `contracts/files/handover`：WI-009 的签署后事实、节点历史、私有文件版本、DG-01 和先行投入。相应 [SPEC](../../docs/requirements/README.md) 与 [共享契约](../../docs/technical/designs/shared/BUSINESS_DELIVERY_CONTRACT.md) 约束事务和敏感边界。
- `delivery/configuration` 与 `delivery/baseline`：WI-010 的发布配置、原项目 DG-02、基线对象、资源/遗留、不可变轮次/基线、责任交接和整组范围草案。DG-02 独立批准通过 `ProjectDirectory.activateDelivery` 切换主阶段；DG-01 继续只输出接续依据。
- 已应用迁移 V1–V21 只可向前追加；新库从 V1–V21 验证。`DeliveryStore` 是不代理的协作者容器，事务由命令服务/读取控制器负责，不在容器上添加 `@Transactional` 后继续直接访问其成员字段。
- Work、Requirement 通过 `ProjectResponsibilityContributor` 贡献未结责任并原位交接；角色调整通过 Project/IAM 公开接口。WorkDirectory 的受信批准接纳接口只能由已完成独立审批与当前权限校验的 Delivery 服务调用，不能暴露为绕过批准的 HTTP 写入口。
- 新整组范围仅在草案预留对象 ID；资源签认合并全部候选投入和其他项目正式承诺，批准前不预占正式容量。提交冻结提案、独立批准一次生效；已完成包、原需求和旧基线不覆盖。对象修订及整组操作说明按预算阅读权投影。

`execution` 对应 WI-011：通过 `ApprovedDeliveryDirectory` 读取非财务批准对象，阶段/清单/里程碑实际另存原对象下。`ExecutionStore` 与 `DeliveryStore` 一样是不代理的协作者，命令和查询服务分别承担事务。`BaselineApplied` 与 Work 执行事件在原事务中校验；待核验职责通过公开 contributor 参加人员交接。文件历史保存原版本 ID，响应按当前读取权投影，不直出受限附件 ID。

Work 的 `DeliveryTask*` 对应 WI-012 / TASK-01：原 TASK 身份，V19 profile/event 与 V20 来源约束；接纳原任务不改 ID/需求。TaskStore 不代理，事务由命令/查询负责。ExecutionDirectory 查询原阶段；Work CompletionEligibility 使需复核的旧 DONE 不能关闭需求，原事实保留。H2 建表不能证明 Flyway CHECK 兼容，迁移须另验。

`finance` 对应 WI-013 / INC-01：IncomeStore 是不代理协作者容器，IncomeService 在项目锁/事务中执行独立预测与收入状态机，IncomeQuery 投影当前可见来源及原历史。V21 单册/单草案/同册外键/正金额/独立确认/单笔已确认冲销约束；金额输出字符串，输入 BigDecimal 精确校验。ContractDirectory.financialReference 和 FileDirectory 提供受控跨域来源；未结 owner/confirmer 接入原 ProjectResponsibilityContributor/DG-02 交接，原提交者不变。FINANCE 四权只加目录定义，无默认授权；五个月份币种窗口、原资料字节与旧任务/执行数据的真实重启验收见 ACCEPT-013。后续经营子域不得将收入确认自动等同回款、开票或成本。
