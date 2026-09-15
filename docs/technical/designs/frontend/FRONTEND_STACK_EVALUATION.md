# 前端技术栈评估与本地验证

> 状态：Ant Design v6 基线已通过本地验证  
> 资料快照：2026-08-26  
> 范围：React SPA、组件体系、表格、表单、路由、数据请求与测试  
> 项目约束：公司内网部署、员工经 VPN 使用、60—100 人、内部管理系统、无 SEO/SSR 需求

本文细化 [ADR-002](../../adr/ADR-002-web-and-service-framework.md) 已确定的 React + TypeScript SPA 方向，并记录 [ADR-012](../../adr/ADR-012-ant-design-v6-component-system.md) 的验证证据；不替代功能 SPEC。

## 1. 结论变化与原因

WI-001 曾验证并接受 shadcn/ui 源码方式 + Base UI。该结论在当时有效，证明“源码可控路线”技术上可行，但也暴露出团队必须自行建设 DataTable、表单模式和大量企业后台组合的持续成本。

项目负责人随后补充了三个决定性约束：

1. 不购买商业组件或模板；
2. 对最终视觉质量有明确要求；
3. 工作计划、项目、人员、文件和阶段管理后续可能用到较多企业后台组件。

因此 WI-002 不是把 Ant Design 与旧体系混用，而是在正式业务页面出现前做一次受控替换和同场景验证。结果支持采用 Ant Design v6 + 项目视觉层，ADR-012 已接受并替代 ADR-011。

## 2. 当前推荐基线

### 2.1 工程与运行

- Node.js 24 LTS、pnpm 11；
- React 19 + TypeScript 6 + Vite 8；
- React Router 8，采用 SPA；
- TanStack Query 5 管理服务端状态；
- Vitest + React Testing Library；真实浏览器质量门使用 Playwright；
- Oxlint 零警告 + Prettier；
- Vite 产出静态资源，内网反向代理提供页面并将 `/api` 转发到 Spring Boot。

项目当前没有 SEO、SSR、React Server Components 或前端 BFF 需求，Next.js 的服务端能力不足以抵消额外复杂度，因此不采用。

### 2.2 组件与视觉

- `antd@6.6.1` 是唯一默认运行时组件体系；
- 根 Provider 使用 `ConfigProvider`、中文 locale 和 Ant Design `App`；
- 项目全局与组件 Token 位于 `src/shared/theme/`；
- Tailwind CSS 4 保留用于页面布局、响应式编排和少量语义样式；
- 组件内部定制使用公开 Token 与 v6 `classNames/styles`，不依赖内部 DOM 或生成类名；
- Lucide React 只在 Ant Design 图标不能表达时补充使用。

视觉质量不等于直接使用 Ant Design 默认主题，也不等于必须拥有全部组件源码。当前选择把通用交互维护交给成熟运行时，把品牌、信息层级、页面组合和业务语义保留给项目。

### 2.3 表格与表单

- 基础数据列表采用 Ant Design Table；
- TanStack Query 负责请求、缓存、失效与失败恢复；
- 服务端分页、排序和筛选保持受控，并在需要恢复时写入 URL；
- 基础编辑采用 Ant Design Form；
- Spring Boot 是业务规则、权限和唯一性判断的最终权威，后端字段错误回填到对应 Form Item；
- 不同时使用 TanStack Table 管理同一张基础表，也不让 React Hook Form 与 Ant Design Form 同时管理同一表单。

出现超大虚拟表格、复杂可编辑表格或表格状态必须脱离视觉层复用的真实证据后，再专项评估 TanStack Table 或其他能力，不预装。

## 3. 当前精确版本快照

| 层次 | 本地锁定版本 |
|---|---|
| Node.js | 24.19.0 LTS |
| pnpm | 11.5.0 |
| React / React DOM | 19.2.8 |
| TypeScript | 6.0.3 |
| Vite / React 插件 | 8.2.2 / 6.1.0 |
| Ant Design | 6.6.1，MIT |
| Tailwind CSS / Vite 插件 | 4.3.3 / 4.3.3 |
| React Router | 8.3.0 |
| TanStack Query | 5.101.4 |
| Vitest / React Testing Library | 4.1.11 / 16.3.2 |

安装事实以 `apps/web/package.json` 与根目录 `pnpm-lock.yaml` 为准。版本管理规则：使用精确版本、提交 lockfile、流水线使用 frozen lockfile、依赖升级建立独立工作项，禁止 alpha/beta/canary 进入基础骨架。

## 4. 候选方案比较

| 方案 | 最终定位 | 结论依据 |
|---|---|---|
| Ant Design v6 + 项目视觉层 | **当前默认** | 免费核心组件覆盖广，三人团队交付成本可控；A/B/C 原型证明可建立非默认主题视觉 |
| HeroUI 免费核心 | 视觉参考或独立短期产品候选 | 默认完成度高，但企业后台组件覆盖不完整，部分 DataGrid、Kanban、Dashboard 能力在商业产品范围；本项目不付费时会重新产生自建或混库成本 |
| shadcn/ui + Base UI | 已验证的可回退历史方案 | 源码和视觉控制力强，但 DataTable、表单模式和大量组合长期由项目维护；不再是当前三人团队的最低总成本方案 |
| Ant Design + 另一套完整 UI 库 | 不采用 | 会形成双主题、双表单、双反馈和 AI 生成代码的选择歧义 |

本次结论不是“Ant Design 组件多所以自动胜出”，而是基于同一项目约束、真实交互原型和维护责任比较后的结果。

## 5. 免费与 ProComponents 边界

本次只使用 `antd` 免费核心包，没有商业模板或付费组件。

`@ant-design/pro-components@2.8.10` 的 npm 元数据虽然是 MIT，但其当前 peer dependency 只声明支持 `antd ^4.24.15 || ^5.11.2`，没有声明支持 v6。因此：

1. 当前工程不安装 ProComponents；
2. 不把 ProTable、ProForm 或 EditableProTable 写入默认架构承诺；
3. 真实功能出现明确缺口、官方声明 v6 兼容后，再验证版本、体积、可访问性和退出方式。

“免费”与“兼容”是两道独立质量门，不能因为许可证免费就忽略 peer dependency。

## 6. 代码边界

```text
apps/web/src/
├── app/                         # Provider、路由和启动装配
├── api/client/                  # HTTP 客户端与统一错误边界
├── features/
│   ├── component-lab/           # 仅开发环境存在的可丢弃原型
│   └── <feature>/               # 正式功能页面、查询、表单和测试
├── shared/
│   ├── layout/                  # AppShell 与跨页面布局
│   ├── theme/                   # Ant Design 项目主题
│   └── patterns/                # 有两个真实消费者后才建立
└── test/                        # 测试环境装配
```

边界规则：

1. `app` 只负责装配，业务实现进入 `features`；
2. 通用 Ant Design 组件可直接使用，不为“看起来统一”而逐个空包装；
3. 只有稳定的业务语义或两个真实消费者才进入共享模式；
4. 功能专用表格列、表单字段、状态和权限判断留在对应功能及 SPEC；
5. URL/导航归 Router，服务端数据归 Query，编辑值归 Ant Design Form；
6. 不再引入另一套 Button、Form、Table、Modal、Toast 或主题系统。

## 7. WI-002 验证设计

开发环境 `/component-lab` 使用两个可复现参数：

- `variant=A|B|C`：A「秩序工作台」、B「现代画布」、C「高密度控制台」；
- `scene=login|list|form`：登录、工作计划列表、工作计划编辑。

三个方向不仅更换颜色，还改变导航、信息分组、留白、密度和操作层级。页面明确标记为可丢弃原型；路由和入口只在 Vite 开发模式注册，不进入生产路由或生产构建。

## 8. 本地验证结果

| 验证项 | 结果 |
|---|---|
| 三种视觉方向 | 通过；URL 可复现，结构与密度明显不同 |
| 登录、列表、编辑场景 | 通过；三个方向均可检查 |
| 核心组件 | Form、Input、Checkbox、TreeSelect、Select、DatePicker、Upload、Switch、Table、Steps、Timeline、Modal、Drawer、Message、Notification、Descriptions、Statistic 通过 |
| 表单反馈 | 必填错误、项目/人员选择和模拟后端同名字段错误回填通过 |
| 表格与浮层 | 选择、固定列、进度、菜单、Modal、Drawer 和通知反馈可操作 |
| 响应式 | 桌面与 390px 通过；检查场景无页面级横向溢出 |
| 键盘 | 全局左右键切换不干扰输入框；Modal/Drawer 支持 Escape；移动导航关闭后焦点恢复 |
| 工程质量 | TypeScript、Oxlint、Prettier、3 个 Vitest 测试和生产构建通过 |
| 浏览器运行 | 首页 `/api` 联调正常；最终检查无 console error |

生产构建成功，但主入口仍有大于 500 kB 的原始 chunk 提示。原型已排除在生产路由和生产构建之外，提示主要来自当前 Ant Design 运行时入口。由于项目尚未形成正式页面和性能预算，本工作项记录风险但不虚构阈值；后续按真实功能路由拆分并建立预算。

## 9. 当前结论与下一步

1. React + TypeScript + Vite SPA 保持不变；
2. Ant Design v6 + 项目视觉层成为默认组件体系；
3. shadcn/ui + Base UI 作为历史验证结果保留，不与当前体系并存；
4. A/B/C 只是帮助选择视觉方向，尚未形成正式页面设计结论；
5. 下一步先选择视觉倾向并完成 `SPEC-IAM-01`，再实现自建账号登录；原型页面不直接扩写为业务页面。

公司实际 Chrome/Edge 版本、屏幕阅读器、严格 CSP、甘特图、超大数据集和正式上传链路仍需随真实功能进入专项验证。
