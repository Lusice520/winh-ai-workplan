# ADR-011：前端组件源码所有权与交互底座

> 状态：已替代  
> 日期：2026-08-26  
> 决策人：项目负责人  
> 关联需求：PRD V0.4；本决策不替代单功能 SPEC  
> 关联验证：[WI-001](../../development-testing/work-items/WI-001-local-project-scaffold.md)、[前端技术栈评估](../designs/frontend/FRONTEND_STACK_EVALUATION.md)、本地 `component-lab`  
> 替代决策：[ADR-012](./ADR-012-ant-design-v6-component-system.md)

> 历史说明：本 ADR 记录 WI-001 时点的有效结论。项目随后基于“不采购商业组件、需要较广企业后台组件覆盖、三人团队降低通用组件维护成本”的新约束完成 WI-002，现由 ADR-012 替代；以下内容保留用于追溯，不再作为当前实施基线。

## 背景与问题

[ADR-002](./ADR-002-web-and-service-framework.md) 已确认 React + TypeScript SPA，但有意没有提前指定 UI 组件体系。项目需要在进入第一个登录功能前确认：团队是否拥有组件源码、复杂交互由谁维护、表格和表单如何组合，以及是否采用 Ant Design 等完整运行时组件库。

此前“评估组件规范与组件库”的讨论已形成倾向：React 项目采用 shadcn/ui 的源码分发方式与 Base UI 交互原语，项目自己拥有 Design Tokens、组件契约、页面模式和 Starter。该方向仍需用真实后台交互验证，不能只凭组件数量或静态截图决定。

## 决策驱动因素

- 三名开发者与多种 AI 工具需要阅读、修改和评审同一份组件源码；
- 系统将长期演进，视觉和业务模式需要可调整，不希望被完整主题包锁定；
- Dialog、Menu、Select、Tabs 等交互的键盘、焦点和 ARIA 行为不适合从零重复实现；
- 内部管理系统需要服务端表格、复杂表单、错误恢复和响应式布局；
- P1 只有 60—100 名用户，不以超大规模前端数据计算作为默认前提；
- 基础体系必须避免双主题、双表单和双反馈机制带来的维护成本。

## 候选方案

### 方案 A：shadcn/ui 源码方式 + Base UI（采用）

按需把组件源码纳入项目，由 Base UI 提供无样式交互内核，项目维护 Token、视觉、契约和组合模式。TanStack Table/Query 与 React Hook Form/Zod 补足表格和表单能力。

优点是源码可控、视觉可演进、复杂行为有稳定原语；代价是团队必须真实承担组件维护，并建设 DataTable 和表单模式。

### 方案 B：Ant Design 等完整运行时组件库

组件覆盖多、管理后台交付快，但会带入完整视觉、主题和运行时契约。若与方案 A 并用，将出现两套 Button、Form、Dialog、Toast 与 Token。只在重型后台场景出现无法合理补足的关键缺口时重新评估。

### 方案 C：HeroUI 等快速成品体系

视觉完成度高，适合短期成品或参考，但外部包的视觉与发布节奏不符合当前“组件源码归项目”的长期目标。不与默认体系混用。

### 方案 D：所有交互从零实现

控制权最大，但焦点、键盘、ARIA、浮层定位和浏览器兼容成本过高，且没有业务收益，不采用。

## 验证证据

本地 `component-lab` 使用锁定版本的 React、Vite、Tailwind、Base UI 及配套库完成了实际运行验证：

- 服务端式表格的分页、排序、搜索、选择、失败与恢复；
- React Hook Form + Zod 的必填、选择器、日期、异步提交、后端字段错误和成功重置；
- Base UI Dialog、Menu、Select、Tabs、Tooltip、Checkbox 等组合；
- Dialog Escape、Menu 键盘操作、桌面侧栏和手机导航抽屉；
- 390px 手机与 1440px 桌面布局；
- 前端通过 `/api` 代理读取 Spring Boot 系统状态；
- 类型、Lint、格式、5 个自动化测试和生产构建全部通过，浏览器控制台 0 error / 0 warning。

验证还发现并修复了一个重要组合问题：中间 Trigger 组件没有透传 Base UI 注入的事件，导致 Dialog 无法打开。这证明公共组件必须验证 `ref` 和属性透传，不能只看类型与视觉。

初始化时 shadcn 官方 Registry 在当前网络访问超时。项目按官方 Base UI 结构建立 `components.json`、Token 和自有组件源码并锁定直接依赖；这不影响运行时验证，也不改变源码所有权决策。

## 决策

1. React 组件采用 shadcn/ui 的“按需引入、源码进入仓库、项目继续维护”方式；
2. Base UI 是 Dialog、Menu、Select、Tabs、Tooltip、Checkbox 等复杂交互的默认无样式底座；
3. Tailwind CSS 4 与项目语义 Token 控制视觉；公共基础组件位于 `apps/web/src/shared/ui/`；
4. TanStack Query/Table 是服务端数据表格默认组合，React Hook Form/Zod 是表单默认组合；
5. 只有两个以上功能形成稳定共同契约后，才建立 `shared/patterns`；功能专用设计留在 `features` 与对应 SPEC；
6. Ant Design、HeroUI、MUI 或另一套完整 UI 体系不得并入默认骨架；例外需要独立验证和新的 ADR；
7. shadcn CLI 是源码辅助工具，不是自动升级器，不得无评审覆盖项目组件。

详细执行规则以[前端共享组件规范](../designs/frontend/FRONTEND_COMPONENT_STANDARD.md)为准。

## 后果

### 正向后果

- 团队和 AI 可以直接阅读、测试和修改组件实现；
- 视觉体系与底层交互解耦，后续可在不重写焦点和键盘逻辑的前提下演进；
- 避免完整 UI 库与自有组件并存造成的双重契约；
- 组件缺口以真实业务场景验证，而不是按库的组件数量做决定。

### 负向后果与控制

- 初期需要维护组件与组合模式：通过组件规范、测试和 `component-lab` 控制；
- shadcn 源码更新不能一键覆盖：通过逐文件比较和独立升级工作项处理；
- 树表、甘特图、超大虚拟表格等能力尚未验证：随功能 SPEC 做专项评估，不预先承诺；
- Base UI 组合仍可能出现属性透传问题：公共组件必须做真实浏览器交互验证。

## 迁移与回退

当前没有业务数据或正式页面，回退成本主要是前端组件源码。如果未来关键场景验证失败，保留 React、TypeScript、Vite 和功能边界，通过新 ADR 选择替代组件体系并制定逐页迁移计划。不得在未完成迁移时长期保留两套默认 UI 体系。

## 复审触发条件

- 两个以上 P1 核心功能在同一类组件上出现无法合理关闭的缺口；
- 无障碍、浏览器兼容、许可或安全要求无法满足；
- 公司要求使用统一前端平台或组件体系；
- 组件维护成本持续高于完整组件库的迁移与锁定成本；
- 前端形态从 SPA 转为 SSR、桌面端或移动原生应用。
