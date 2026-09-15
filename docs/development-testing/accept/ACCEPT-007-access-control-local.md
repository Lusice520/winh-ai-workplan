# ACCEPT-007：菜单与权限本地验收

> 日期：2026-09-13（Asia/Shanghai）  
> 结论：WI-007 本地验收通过；不代表生产部署或整个系统完成  
> 关联：[WI-007](../work-items/WI-007-menu-permission-management.md)、[TC-007](../test-cases/TC-007-menu-permission-management.md)、[SPEC-IAM-02](../../requirements/specs/role_permission_spec.md)

## 实际完成

- 菜单资源、权限目录、系统/项目/阶段角色、权限矩阵、系统角色分配、临时授权与有效权限预览均接入服务端正式决策。
- 高敏感临时授权必须经过指定独立账号实际复核。申请人、受授人、复核人两两不同，批准仍使用原范围与时限；审批时再次核对授予人当前权限。拒绝、撤销和到期不能产生访问能力。
- 角色创建严格低于操作者级别，编辑/停用/撤销均检查原角色级别及包含的权限。不能通过先降级、清空授权集或间接分配角色绕过边界；正式安全管理员的受保护角色例外见 SPEC。
- 初始化直接放行、无限下放层级与静态 `BOOTSTRAP_ADMIN` authority 已删除。初始化账号只通过正式持久化角色获得访问，初始化标记保留账号保护含义。
- 系统角色页按服务端搜索分页读取账号；组织/用户、角色、菜单与临时授权操作根据实际能力显示或禁用。菜单编辑抽屉直接显示引用影响，根目录仅改名不会误发移动操作。
- IAM 写入幂等绑定操作者及完整内容；通用表单同时提交请求标识和幂等头，复核重试使用同一标识。未实现操作返回准确的 404/405，负向校验保留 400/403/409 含义。

## 验证证据

| 验证层 | 结果 | 证据 |
| --- | --- | --- |
| 后端自动化 | 24 项测试通过；登录、停用撤销会话、临时密码限制、独立复核、原角色保护、幂等和硬约束均覆盖 | 本地日志 `.local-data/wi007-no-bridge-backend-v3.log` |
| 前端检查 | 类型、lint、格式、31 项交互测试、生产构建通过 | `.local-data/wi007-final-web-v4.log` |
| 真实接口 | 5 组通过，含授予/撤销、拒绝/到期、限定项目合同敏感字段变化与导航/HTTP 一致性 | [api-checks.json](../../../outputs/verification/wi-007/api-checks.json) |
| 浏览器写入 | 分配/收回只读角色、独立复核批准、撤销临时权限、菜单名称排序与停用均实际保存 | [browser-readback.json](../../../outputs/verification/wi-007/browser-readback.json) |
| 现有库重启 | V10 校验通过；正式管理员可创建用户，未知权限预览返回 404、硬约束拒绝 | [bootstrap-8080.json](../../../outputs/verification/wi-007/bootstrap-8080.json) |
| 空库首次启动 | 全新库从空 schema 应用 V1–V10；正式角色引导、创建用户和拒绝边界通过 | [bootstrap-8081.json](../../../outputs/verification/wi-007/bootstrap-8081.json)、`.local-data/wi007-no-bridge-fresh.log` |
| 审计 | 验证对象创建、修改、系统角色替换、独立复核、撤销等事件保留 | [audit-counts.json](../../../outputs/verification/wi-007/audit-counts.json) |

## 浏览器结果

1. 对合成账号 `wi007-browser-mtypjyd8` 增加只读角色，用户目录返回 200，页面没有新增用户/部门按钮。随后通过同一页面收回只读角色，导航不再显示组织用户，直接请求目录返回 403；原业务员工角色与撤销历史保留。
2. 合同敏感权限在待复核时 `sensitiveVisible=false`，指定复核人从页面批准后为 `true`，管理员通过页面撤销后回到 `false`。复核与原申请的起止时间逐字段一致。
3. 菜单验证目录先显示 0 个子资源、0 个权限项及 0 个角色/临时授权引用，再实际停用；改名、排序与稳定编码重新读取一致。后续纯改名只发出 PATCH，不再发出空父级移动请求。
4. 390×844 视口下记录抽屉宽 390，页面宽 390，原申请、复核意见、撤销原因完整可读。成功路径最终控制台无新增错误；故意访问被收回的目录产生预期的 403。

最终截图：[角色授予](../../../outputs/verification/wi-007/browser-role-assigned.png)、[只读目录](../../../outputs/verification/wi-007/browser-role-readonly.png)、[收回后的拒绝](../../../outputs/verification/wi-007/browser-role-revoked.png)、[资源影响](../../../outputs/verification/wi-007/browser-menu-impact.png)、[授权历史桌面](../../../outputs/verification/wi-007/browser-review-record-desktop.png)、[授权历史窄屏](../../../outputs/verification/wi-007/browser-review-record-mobile.png)。动画过程中的早期截图不用于最终视觉验收。

## 数据与剩余边界

- 仅使用本地合成账号、角色、目录及既有合成项目。会话文件保存在已忽略的 `.local-data/`，不进入证据文件；没有读取或保存真实人员密码及会话令牌。
- V10 已在现有库与新库应用，之后只允许前向迁移。既有验证授权、历史事件及已停用资源全部保留。
- 初次目录验证曾因空父级比较产生一次无实际层级变化的移动审计；缺陷已修正，原事件不删除、不冒充真实层级变化。
- 临时授权/权限预览的账号候选仍有 100 条读取上限，需在后续共享候选选择任务扩展；系统角色账号列表已支持搜索和分页。
- 审计中心检索、消息通知、大规模人员目录、生产权限治理与性能基准仍需对应工作项验证。前端共享依赖包有 500 kB 构建提示。
- 未执行 commit、push、MR、部署、外部通讯或生产数据修改。
