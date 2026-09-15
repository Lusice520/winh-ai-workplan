# ADR-012：Ant Design v6 默认组件体系与项目视觉层

> 状态：已接受  
> 日期：2026-08-26  
> 决策人：项目负责人  
> 关联需求：PRD V0.4；本决策不替代单功能 SPEC  
> 关联验证：[WI-002](../../development-testing/work-items/WI-002-antd-v6-visual-validation.md)、本地 `/component-lab?variant=A|B|C`  
> 替代：[ADR-011](./ADR-011-frontend-component-source-and-primitives.md)

## 背景与问题

WI-001 已证明 shadcn/ui 源码方式 + Base UI 能承担当前基础交互，但该路线把 DataTable、表单模式、视觉一致性和公共组件维护责任主要交给三人团队。项目负责人进一步明确了三个共同约束：不购买商业组件或模板、对视觉质量有明确要求、后续可能使用较多企业后台组件。

因此需要复审 ADR-011 的优化目标。源码完全归项目能提高控制力，却不自动等于更低总成本；对本项目而言，免费组件覆盖、交付速度、三种 AI 工具生成代码的一致性和可持续视觉定制，应与源码所有权共同评估。

## 决策驱动因素

- 项目不采购 HeroUI Pro 或其他商业 UI 组件、模板和 AI 文档服务；
- 工作计划、项目、人员、文件和阶段管理可能需要 Table、Form、Upload、Tree/TreeSelect、Steps、Timeline、Cascader、Transfer、Descriptions、Statistic、Tour 等组件；
- 默认视觉必须通过项目 Token 和语义样式形成辨识度，不能直接交付 Ant Design 默认主题；
- 三名开发者分别使用 Trae、Claude Code 和 Codex，需要稳定、文档充分且 API 一致的默认组件体系；
- 当前尚无正式业务页面或历史前端数据，替换组件层的退出成本较低；
- React 19 和现代浏览器目标满足 Ant Design v6 的运行前提；
- 不允许长期并存两套 Button、Form、Table、Modal、反馈和主题契约。

## 候选方案

### 方案 A：Ant Design v6 + 项目视觉层（采用）

以 Ant Design v6 免费核心组件为默认运行时，通过 `ConfigProvider`、全局 Token、Component Token、CSS Variables 和 v6 语义 `classNames/styles` 定制视觉。Tailwind CSS 保留用于页面布局、少量语义样式和原型效率，不通过深层 DOM 选择器覆盖组件内部实现。

优点是免费组件覆盖广、企业后台交付快、React 19 支持明确，表单、表格、上传、树和流程类组件来自同一体系。代价是依赖外部包的运行时和升级节奏，视觉自由度低于项目完全拥有组件源码。

### 方案 B：HeroUI v3 免费核心

默认视觉完成度高，React Aria、Tailwind CSS 4 和组合式 API 有利于快速产出。但当前免费目录没有覆盖项目可能使用的全部企业后台组件，DataGrid、Kanban、Dashboard 模板等属于 HeroUI Pro 商业范围。若不付费，缺口需要项目自建或再次引入其他库，会削弱单一体系和快速交付优势。

### 方案 C：继续 shadcn/ui 源码方式 + Base UI

源码与视觉控制力最强，WI-001 已证明基础能力可行；但团队需要长期建设和维护 DataTable、表单模式、上传、树、流程与大量组合组件。它仍是可回退基线，但不再是当前约束下总成本最低的选择。

### 方案 D：Ant Design 与 HeroUI/shadcn 并行

可以按页面短期选用最合适的组件，却会形成双主题、双表单、双反馈和交互差异，增加团队与 AI 的选择成本，不采用。

## 验证证据

WI-002 已提供以下证据：

1. `antd@6.6.1` 已精确写入 `package.json` 和 lockfile；npm 元数据为 MIT，仓库未引入付费组件或模板；
2. 开发环境 `/component-lab` 提供 A「秩序工作台」、B「现代画布」、C「高密度控制台」三个结构和视觉明显不同的方向，使用 `variant` 与 `scene` URL 参数复现；
3. 三个方向均可检查登录、工作计划列表和工作计划编辑场景；
4. 已真实操作 Form、Table、Upload、TreeSelect、Steps、Timeline、Modal、Drawer、Message 和 Notification；
5. 全局 Token、Component Token 与公开语义样式能够改变品牌色、字体、圆角、阴影、密度和主要组件视觉，而非仅替换主色；
6. TypeScript、Oxlint、Prettier、Vitest 和生产构建通过；1440px 桌面和 390px 窄屏无页面级横向溢出；
7. 左右键切换不劫持输入框，Modal/Drawer 支持 Escape，移动导航关闭后焦点返回触发按钮，最终浏览器控制台无错误；
8. 生产构建仍提示主入口原始 chunk 大于 500 kB；这是后续建立性能预算和按真实路由拆分时需要跟踪的风险，不伪装成已关闭；
9. `@ant-design/pro-components@2.8.10` 虽为 MIT，但当前 peer dependency 只声明支持 antd v4/v5，未声明支持 v6，因此本次明确不安装。

## 决策

采用以下基线：

1. Ant Design v6 是 React 应用唯一默认运行时组件体系；工程初始化精确锁定已验证补丁版本，ADR 只锁定主版本；
2. `ConfigProvider` 和 Ant Design `App` 统一语言环境、Theme Token、Modal、Message 与 Notification 上下文；
3. 全局与组件 Token 定义在 `src/shared/theme/`，颜色、字体、圆角、阴影、密度和状态语义由项目维护；
4. Tailwind CSS 4 继续负责页面布局和允许的语义样式，组件内部定制优先使用 Ant Design Token 与 v6 `classNames/styles`；
5. TanStack Query 继续管理服务端请求、缓存和失败恢复；基础表格采用 Ant Design Table，出现已证明的独立表格状态需求时再评估 TanStack Table；
6. 基础表单采用 Ant Design Form，Spring Boot 是业务规则、权限和唯一性判断的最终权威；不得同时让 React Hook Form 与 Ant Design Form 管理同一表单状态；
7. 只对高频、业务语义或必须统一契约的组件建立项目包装；普通低风险组件可以直接使用 Ant Design，但必须消费项目主题；
8. `@ant-design/pro-components` 虽为免费开源候选，但当前版本没有声明支持 antd v6，本次不安装；出现真实 ProTable、EditableProTable 或 ProForm 需求且官方兼容关系明确后，再独立验证包体积和退出方式；
9. HeroUI、Base UI、shadcn 默认组件或另一套完整 UI 体系不得与 Ant Design 并入正式骨架；例外需要新的 ADR；
10. `/component-lab` 是可丢弃原型。视觉方向确定后，正式页面必须依据对应 SPEC 重写，原型不直接晋升为生产代码。

## 后果

### 正向后果

- 免费核心组件覆盖更符合项目未来的后台场景；
- 团队减少对通用组件、焦点、浮层、表单和复杂数据录入的重复维护；
- 同一套组件 API 和官方文档降低三种 AI 工具生成不一致实现的概率；
- v6 Token 与语义样式允许在不分叉组件源码的情况下建立项目视觉；
- 当前无正式页面与业务数据，切换不会产生用户数据迁移。

### 负向后果与控制

- 对 Ant Design 运行时和发布节奏形成依赖：精确锁定版本、提交 lockfile、依赖升级使用独立工作项；
- 深度视觉修改可能与升级冲突：禁止依赖内部 DOM 层级和生成类名，优先使用公开 Token 与语义 API；
- 组件运行时增加构建体积：当前生产构建成功但主入口存在大于 500 kB 的原始 chunk 提示；保持 ESM 引用、按正式功能路由拆包，并在形成性能预算后把预算纳入 MR 门；
- 业务页面容易退化为默认后台模板：功能 SPEC 必须定义信息层级和交互，组件库不代替产品设计；
- Ant Design Form 与现有 React Hook Form 迁移存在一次性成本：当前只有实验页，WI-002 直接移除旧表单实现，不保留双状态。

## 迁移与回退

WI-002 只迁移本地骨架和组件实验页：保留 React、TypeScript、Vite、Router、TanStack Query、后端代理和目录边界；替换 Provider、Theme、AppShell、实验页及旧共享 UI 依赖。

若视觉、组件覆盖、响应式、可访问性、构建或许可任一关键门失败，恢复 WI-001 记录的依赖与组件实现，并把本 ADR 标记为“已拒绝”。不得通过长期混用两套体系来掩盖失败。

## 复审触发条件

- 两个以上核心功能无法通过公开 Token 或语义 API 达到已接受视觉；
- 组件缺陷、无障碍、安全或浏览器兼容问题无法在可接受时间内关闭；
- 构建体积或运行性能超过后续确定的前端预算；
- 公司形成统一组件平台或必须兼容另一套既有前端；
- React、浏览器或 Ant Design 主版本升级需要不兼容迁移；
- 团队长期只使用少量基础组件，完整运行时的收益低于其约束成本。
