# BUG-001：CSRF 失效被错误归类为权限不足

> 状态：待回归  
> 报告人：Lusice  
> 负责人：项目负责人（本机实现：Codex）  
> 优先级：P1  
> 发现版本与环境：本机 PostgreSQL + Spring Boot + Vite，系统管理 / 组织与用户  
> 关联 SPEC / WI / MR：[SPEC-IAM-01](../../requirements/specs/organization_user_account_spec.md)、[WI-006](../work-items/WI-006-login-user-management-local.md)；本地开发，暂无 MR

## 1. 现象与影响

- 实际结果：初始化系统管理员在新建用户抽屉提交时，页面显示“当前账号没有执行该操作的权限。”；服务端把 CSRF 校验失败和真实授权拒绝都返回为 `403 ACCESS_DENIED`。
- 预期结果：CSRF 令牌缺失、过期或无效时返回独立的可恢复错误；只有服务端实际授权拒绝时才提示账号无权限。
- 影响用户、数据或流程：管理员无法判断应重新提交还是申请权限，容易放弃已填写的用户建档表单；失败请求不写入用户数据。
- 是否涉及安全、权限或数据完整性：涉及 CSRF 防护与权限提示准确性；修复不放宽任何权限，也不新增数据库数据。

## 2. 可重复复现

### 前置条件

- 存在启用的初始化系统管理员和启用组织；
- 管理员已登录，并获得会话与 CSRF Cookie。

### 步骤

1. 使用初始化系统管理员认证；
2. 对 `POST /api/iam/users` 保留会话与 CSRF Cookie，但移除或使 `X-XSRF-TOKEN` 无效；
3. 提交有效的新建用户请求；
4. 以普通启用用户访问 `GET /api/iam/users`，用于比较真实授权拒绝。

### 复现证据

- 修复前第 3 步返回 `403 ACCESS_DENIED`，与项目负责人提供的真实浏览器错误一致；
- 修复前后端 HTTP 集成测试可稳定复现该结果；
- 复现频率：必现（缺少或无效 CSRF）。

## 3. 定位与根因

- 已排除：数据库中初始化管理员桥接标记、启用状态与会话均正常；同一初始化管理员使用有效 CSRF 可读取用户目录并到达用户创建字段校验。
- 根因证据：`ApiAccessDeniedHandler` 将 Spring Security 的 `CsrfException` 与实际 `AccessDeniedException` 统一映射为 `ACCESS_DENIED`，导致错误语义丢失。
- 受影响范围：所有受到 CSRF 保护的写接口；账号、组织和后续 IAM 写操作均可能显示误导性提示。

## 4. 修复范围

- 允许修改的模块或路径：`apps/backend/src/main/java/com/winh/workplan/iam/identity/ApiAccessDeniedHandler.java`、`apps/backend/src/test/java/com/winh/workplan/iam/identity/LoginAndUserManagementIntegrationTest.java`、`apps/web/src/api/client/http.ts`、`apps/web/src/api/client/http.test.ts`，以及关联 SPEC/WI/TC。
- 负责人和分支：本机开发；不创建 Git 提交、分支或 MR。
- API / 数据库 / 配置影响：新增公开问题码 `403 CSRF_VALIDATION_FAILED`；真正无权限仍是 `403 ACCESS_DENIED`。无数据库迁移、无配置变更。

## 5. 回归结果

| 场景                               | 结果         | 证据                                                              |
| ---------------------------------- | ------------ | ----------------------------------------------------------------- |
| 原始缺少 CSRF 的管理员新建用户请求 | 已通过自动化 | 返回 `403 CSRF_VALIDATION_FAILED`，提示先再次提交、持续失败再刷新 |
| 缓存 CSRF 令牌失效后的再次手动提交 | 已通过自动化 | 前端清除缓存并重新请求令牌；不自动重放写请求                      |
| 普通用户访问 IAM 管理接口          | 已通过自动化 | 仍返回 `403 ACCESS_DENIED`                                        |
| 项目负责人真实浏览器新建用户提交   | 待回归       | 本机后端已重启并加载修复，等待当前抽屉再次提交                    |

- 回退方式：本次没有数据迁移；若出现兼容问题，以新的代码修正恢复原有问题码映射，不删除账号、组织、审计或会话记录。
- 关闭结论：等待项目负责人在真实浏览器确认一次有效创建后关闭。
