# IAM Foundation Contract：身份、会话、接口与审计共用契约

> 状态：已基线（IAM-01）  
> 最后更新：2026-08-28  
> 适用范围：登录、组织与用户管理，以及后续需要当前账号、会话、审计或权限决策的所有业务功能  
> 关联 SPEC / ADR：[SPEC-IAM-01](../../../requirements/specs/organization_user_account_spec.md)、[SPEC-IAM-02](../../../requirements/specs/role_permission_spec.md)、[ADR-001](../../adr/ADR-001-application-runtime-shape.md)、[ADR-003](../../adr/ADR-003-relational-data-transaction-and-cache.md)、[ADR-005](../../adr/ADR-005-local-identity-authentication-and-session.md)、[ADR-006](../../adr/ADR-006-reliable-business-events-and-jobs.md)

## 1. 目标、范围与非目标

本契约让前端、身份会话、组织用户、审计以及后续菜单权限模块使用同一套安全边界、错误格式、分页和变更关联方式。它不是某个页面的字段说明；页面字段、流程和具体资源 API 仍以对应 SPEC 为准。

本契约覆盖：

- 浏览器会话、CSRF、防止失效账号继续访问；
- 当前账号、统一问题响应、分页、并发版本与幂等键；
- 管理与安全审计的最小事件包络；
- 从当前初始化系统管理员桥接到正式菜单权限决策的替换边界。

本契约不覆盖：完整菜单树、权限项、角色类型、数据范围合并规则、临时授权或权限缓存；这些均由 SPEC-IAM-02 冻结后实现。

## 2. 统一契约与不变量

### 2.1 身份与浏览器会话

1. 首期仅支持本地账号密码；系统不提供自助注册。
2. 成功登录后，服务端生成不可预测的随机会话令牌，只在浏览器 `HttpOnly` Cookie 中传输；数据库仅保存令牌哈希。
3. 会话绝对有效期最多 8 小时，空闲超时 30 分钟。成功登录和改密必须轮换当前会话标识；退出、停用、锁定、离职和重置密码必须撤销该账号全部有效会话。
4. `SESSION` Cookie 使用 `HttpOnly`、`SameSite=Lax`、`Path=/`；正式环境必须 `Secure`。本地开发 profile 可在 HTTPS 不可用时关闭 `Secure`，但不得把该开关带入生产环境。
5. 写请求一律校验 CSRF：前端先取得可读的 `XSRF-TOKEN` Cookie，并在 `POST`、`PATCH`、`PUT`、`DELETE` 时传 `X-XSRF-TOKEN` 请求头。会话 Cookie 不可由前端 JavaScript 读取。
6. 前端请求必须使用 `credentials: include`。登录失败、会话过期和无效账号均不得通过客户端缓存的用户资料绕过后端判断。

### 2.2 认证与账号不变量

- 密码只以维护中的单向哈希保存，不写入日志、审计前后值、错误响应或数据库明文字段。
- 登录接口对不存在账号、密码不匹配、停用、锁定和离职均返回相同的外部消息与 `401 AUTHENTICATION_FAILED`；详细原因只进入受限安全审计。
- 连续 5 次失败锁定账号 15 分钟；成功认证清零失败计数。
- 初始化系统管理员由安全环境变量在空库首启时创建，并映射为正式安全管理员角色。该标记本身不授予接口、导航或下放权限。不得由普通用户管理 API 赋予、移除或枚举该标记；最后一个初始化系统管理员不可被停用、锁定、离职或降级。

### 2.3 HTTP 问题响应、分页、版本与幂等

所有业务 API 使用 JSON 和 `/api` 前缀。可预期失败采用下列结构；`fieldErrors` 只在字段校验失败时出现：

```json
{
  "code": "VALIDATION_FAILED",
  "message": "请检查输入后重试。",
  "fieldErrors": [{ "field": "loginName", "message": "登录账号已存在。" }],
  "correlationId": "01J..."
}
```

| 主题      | 统一规则                                                                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP 状态 | `400` 参数/字段错误；`401` 未认证或中性认证失败；`403` 已认证但无权；`404` 不存在；`409` 唯一性、状态、版本或幂等冲突；`500` 未预期错误且不暴露内部细节。                                                                 |
| 分页      | 请求使用 `page`（从 1 开始）与 `pageSize`；响应包含 `items`、`page`、`pageSize`、`total`。前端页码选择必须真实触发请求，不得只改变视觉状态。                                                                              |
| 乐观并发  | 可编辑资源响应包含 `version`；更新请求必须携带该版本，冲突返回 `409 VERSION_CONFLICT`，前端提示重新加载而不是静默覆盖。                                                                                                   |
| 幂等      | 状态变更、调动、密码重置等高风险写操作必须带 `Idempotency-Key`。同键同摘要返回原结果；同键不同摘要返回 `409 IDEMPOTENCY_CONFLICT`。摘要不得包含密码、会话令牌或其他原始密钥；密码重置重试以账号、版本和原因识别同一操作。 |
| 关联 ID   | 后端为每个请求分配或接受可信 `correlationId`，问题响应和审计事件均记录它；不得将敏感 Cookie 或密码写入关联日志。                                                                                                          |

### 2.4 审计事件包络

需要审计的身份和管理操作，在保存业务事实的同一事务中追加事件。最小字段：

| 字段                                        | 含义                                                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `eventType`                                 | 稳定动作编码，例如 `AUTH_LOGIN_SUCCEEDED`、`AUTH_LOGIN_FAILED`、`USER_CREATED`、`ACCOUNT_STATUS_CHANGED`、`ACCOUNT_SESSIONS_REVOKED` |
| `actorAccountId`                            | 操作者；匿名登录失败可为空或使用匿名主体                                                                                             |
| `subjectType` / `subjectId`                 | 被操作的资源类型与 ID                                                                                                                |
| `outcome`                                   | `SUCCEEDED` / `DENIED` / `FAILED`                                                                                                    |
| `occurredAt` / `correlationId`              | 可排序时间和跨请求排查关联                                                                                                           |
| `beforeSummary` / `afterSummary` / `reason` | 仅存经脱敏的业务摘要；绝不存密码、会话令牌或完整敏感联系方式                                                                         |

审计 Module 只记录事实，不决定业务是否允许；后续中心检索页以该事件源读取，不能让页面另存一套历史。

## 3. Module Interface 与替换边界

模块之间不得访问对方 Repository 或表。首期至少暴露下列稳定语义；内部实现可变化：

| Module                                | 公开 Interface 语义                                                                                                                          | 当前消费者                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Identity & Session                    | `authenticate`、`currentPrincipal`、`changePassword`、`revokeSessionsForAccount`                                                             | 登录页、Spring Security Adapter、账号生命周期 Module |
| Organization Directory                | `readTree`、`createUnit`、`updateUnit`、`changeUnitStatus`                                                                                   | 用户管理 Module、组织与用户页面                      |
| Organization & Account Administration | `queryUsers`、`getUser`、`createUser`、`updateUser`、`moveUser`、`transitionAccount`、`resetPassword`                                        | 用户管理 HTTP Adapter                                |
| Audit                                 | `record(event)`                                                                                                                              | 身份、组织与账号 Module                              |
| Menu & Authorization（IAM-02）        | `listNavigation(subject)`、`decide(subject, action, resourceContext)`、`replaceSystemRoleAssignments(command)`、`listAssignableRoles(scope)` | AppShell、所有业务 HTTP Adapter、系统角色授权工作区  |

2026-09-13，WI-007 已完成正式角色与跨账号浏览器验收，初始化直接访问桥接已删除。所有 IAM-01 管理端点与 AppShell 使用 `decide(...)` 与 `listNavigation(...)`；初始化标记只保留账号保护和正式角色引导用途。

### 3.1 IAM-02 授权语义

1. `decide(subject, action, resourceContext)` 是所有实际访问的唯一服务端判断，返回 `ALLOW` 或 `DENY`、稳定原因码和仅对有权管理员可见的脱敏解释摘要。AppShell、按钮显隐和路由守卫只能消费结果，不能生成另一套放行规则。
2. 有效系统/项目/阶段角色与有效临时授权只提供正向 `ALLOW`；匹配的正向授权可并集。账号或会话无效、资源或权限项未注册/停用、组织/项目/对象范围不匹配、记录状态受限、敏感字段/文件密级不满足或资源强制条件失败时，必须 `DENY`，且硬约束优先于任何角色或临时授权。
3. 统一数据范围仅使用 `SELF`、`OWN_ORG`、`OWN_ORG_AND_DESCENDANTS`、`NAMED_ORG_UNITS`、`PARTICIPATING_PROJECTS`、`NAMED_PROJECTS`、`NAMED_OBJECTS`、`ALL_ORGANIZATION` 与 `ALL_PROJECTS`。业务 Module 不得自创语义相同的范围枚举。
4. 临时授权必须同时匹配受授人、资源、动作、最小范围和服务端时间窗口；普通上限为 7 天，高敏感上限为 24 小时，创建后为 `PENDING_REVIEW`，必须由指定、具备 `IAM_TEMPORARY_GRANT_REVIEW` 的独立账号实际批准后才可生效。申请人、受授人、复核人须两两不同；审批保留原范围与期限，并重验原授予人当前权限。它不能绕过账号、资源、密级或不可下放约束。
5. `listNavigation(subject)` 只返回主体有菜单查看权、菜单资源启用、且前端已实现 `routeKey` 的节点。数据库保存的是受控键，不接受任意 URL、图标名或后端动作；没有已实现页面的静态侧边栏入口不得成为导航兜底。
6. 首期不使用跨请求或跨进程的授权结果缓存。每次 `decide(...)` 读取当前授权事实；`listNavigation(...)` 在登录、刷新和相关授权管理写入后重新获取。后续若引入缓存，必须单独评审失效、撤销和到期边界。
7. IAM-02 初始化在同一受控迁移中将当前初始化管理员映射为首个 `SYSTEM_SECURITY_ADMIN` 分配；该分配已通过现有库与空库验证，`BOOTSTRAP_ADMIN` 静态 authority 及直接放行分支已删除。

## 4. 数据迁移、兼容与运行

1. PostgreSQL 是结构化事实主库；所有 schema 变更只追加 Flyway 前向迁移，已应用迁移不可改写。
2. 每个表由一个 Module 负责；跨 Module 不以外键直写对方业务表作为快捷方式。
3. 启动时先校验连接并执行 Flyway，再运行只在空库条件成立的初始化管理员/根组织引导。环境变量缺少初始化管理员必需密码时，应明确拒绝初始化，而不是写入默认密码。
4. 本地数据库数据属于 `.local-data/`，不进入版本库；环境变量示例只给出键名和非敏感示例值。
5. 删除或回退功能时，不删除账号历史、会话撤销记录或审计事件；用新的前向迁移和业务状态实现可逆处理。

## 5. 前端复用方式

- `api/client` 负责凭据、CSRF、问题响应、关联 ID 和错误映射；功能页面不得各自手写 `fetch` 安全策略。
- 认证状态只通过 `GET /api/auth/me` 建立。路由守卫在未认证时跳转 `/login`；`401` 时清空本地会话视图并回到登录页，`403` 显示无权限而不伪装成空数据。
- 表格分页、过滤和搜索由功能的 application 层持有；选择“每页多少条”必须是实际可用下拉项，且弹层不会因外层滚动或裁切而抖动、贴边或消失。
- 用户和部门表单遵循已确认的块状分组：单行字段一行一个、左标签右控件；多行说明上标签全宽控件。

## 6. 验证方式

1. Module 行为测试覆盖认证、锁定、会话撤销、账号唯一性、组织循环、版本冲突和最后管理员保护。
2. Flyway 在干净本地 PostgreSQL 实例上可重复执行；启动后不含默认明文密码。
3. HTTP 集成测试验证 Cookie、CSRF、`401/403/409`、字段错误、分页和幂等键。
4. 浏览器 E2E / 人工验收验证登录、登出、首次改密、用户创建、停用会话即时失效、分页选择和表单错误回填。
5. SPEC-IAM-02 已新增“动态导航 + 服务端 `decide` 一致性、硬约束拒绝优先、临时授权到期”回归测试，并已移除初始化管理员桥接。

## 7. 风险与未决项

- PostgreSQL 的本地运行方式、备份和恢复脚本属于当前 IAM-01 实施工作项；生产数据库与公司私网部署仍需单独验收。
- SSO、MFA、企业密码制度、登录 IP 限流和设备策略不在首期范围；任何上线前安全要求变更需复审 ADR-005。
- IAM-02 的授权合并、硬约束拒绝优先、数据范围、临时授权上限、受控导航键与无跨请求缓存策略已在 SPEC-IAM-02 v0.4 冻结；当前登录/用户代码仍不得私自引入第二套判断。后续业务资源、敏感字段和项目成员接入随各自 SPEC 冻结。
