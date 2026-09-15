# Web 前端上下文

> 适用范围：`apps/web/` 的 React、TypeScript、路由、主题、HTTP 客户端和前端测试。  
> 正式事实入口：[项目上下文导航](../../CONTEXT-MAP.md)

## 开始前读取

1. 对应 work-item、PRD/SPEC，以及与本功能有关的测试与验收资料。
2. [前端共享组件规范](../../docs/technical/designs/frontend/FRONTEND_COMPONENT_STANDARD.md)。
3. [总体技术方案](../../docs/technical/TECHNICAL_SOLUTION.md)和本功能关联 ADR；IAM 首个切片至少读取 [ADR-001](../../docs/technical/adr/ADR-001-application-runtime-shape.md) 与 [ADR-005](../../docs/technical/adr/ADR-005-local-identity-authentication-and-session.md)。
4. 对应 API contract 和共享设计；在其冻结前，不把浏览器内 Mock 数据当成生产数据来源。

## 约束

- `features/<feature>/` 负责功能专用页面、字段、查询与交互；只有两个真实消费者需要相同且稳定的契约时，才提取到 `shared/`。
- 正式服务端数据通过功能的 `api/` 与 `application/` 层读取和提交；UI 不能直接拼装权限、生命周期、并发或审计规则。
- 使用项目现有 Ant Design v6、Theme Token、React Router 和 TanStack Query 基线；不引入第二套完整组件体系。
- Mock 仅留在测试 fixture、视觉原型或明确的开发环境隔离中；正式页面必须处理加载、错误、无权限、服务端字段错误、分页和并发结果。
- 每项变更按 work-item 运行相关类型、Lint、格式、单测、构建和浏览器验证；跨端流程还需端到端证据。

## 当前业务入口

`features/crm/project/presales/requirements/work` 对应 WI-008；`features/contracts/files/handover` 对应 WI-009。采用 draw-ui 校准的紧凑事实栏、真实清单/历史和侧栏，避免用虚构数字或空面板填充。项目内标签保留原项目上下文，交付移交包含 DG-01 与提前开工两个子入口。节点历史、合同金额和投入明细遵循服务端敏感权限；只读抽屉不显示保存动作。

`features/delivery` 对应 WI-010：系统二级“交付立项”与“交付模板与规则”，项目空间固定阶段、里程碑/计划、清单、预算和成员视图。工作包从立项/关联对象进入原 Work 记录，不新建项目固定标签。范围提案将原对象与拟变更对象分别展示，待批准内容不当作执行事实；责任交接、资源签认和独立审核使用服务端动作集合。

复用类型化 `delivery-editor` 表单、`ObjectReadout`、只读轮次/基线/修订查看器；`scopeWorkspace` 只在草案表单内适配候选关联项，不改变真实立项状态。预算、规则、变更说明和修订说明由服务端投影，前端不得缓存越权旧数据继续展示。桌面两列对象/资源卡片、390px 单列；变更错误保留输入及原幂等键。

`features/execution` 对应 WI-011 / EXEC-01：DG-02 批准后在固定阶段、清单、里程碑入口切换“执行与实际 / 批准范围与计划”，原工作包显示所处阶段与清单实际。服务端给出实际可操作集合，筛选仅处理当前已授权项目数据；手机先显示本人待核验，长表局部滚动。最近三条旁列，最近 100 条和原对象完整历史按需读取；历史文件版本由服务端逐项投影。

`features/tasks` 对应 WI-012 / TASK-01：原包进入 `/projects/:projectId/work-packages/:workPackageId/tasks`，同一任务仍用 `/work-items/:id`；根据 taskWorkPackageId 接续详情。动作遵循 allowedActions，完成前等待资料选项。URL 保存筛选/分页，取消单列且不计有效完成率。历史可展开前后事实和原文件；390px 核验优先，表格局部滚动，侧栏卡片铺满容器。

`features/income` 对应 WI-013 / INC-01：项目固定“资金计划”兼容原预算，并进入 `/projects/:projectId/income`。月度币种窗口独立汇总，当前发布版/草案/弃版分开；收入与原预测/原资料版本可下钻，按 allowedActions 显示本人动作。金额使用字符串及整数分；表单验证精度且不舍入，409 保留输入。收入筛选通过局部 useIncomeSearchParams 合并连续导航前的参数，刷新保留条件，汇总仍为全月。390px 待办在台账前，表格局部滚动；详情字段 span=filled 适应单列。验证见 ACCEPT-013。
