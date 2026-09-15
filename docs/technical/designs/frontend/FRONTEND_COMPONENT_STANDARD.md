# 前端共享组件规范

> 状态：V2 已生效  
> 生效日期：2026-08-26  
> 关联决策：[ADR-012：Ant Design v6 默认组件体系与项目视觉层](../../adr/ADR-012-ant-design-v6-component-system.md)  
> 验证依据：[WI-002：Ant Design v6 组件基线与视觉验证](../../../development-testing/work-items/WI-002-antd-v6-visual-validation.md)

本规范约束多个功能共同使用的组件、主题和页面组合。单功能页面的字段、状态、文案、接口、权限和交互细节仍写在对应 SPEC 中，不在这里建立平行 DES。

## 1. 当前组件基线

前端只维护一套默认运行时组件体系：Ant Design v6。当前工程精确锁定 `antd@6.6.1`；补丁版本以 `apps/web/package.json` 和 `pnpm-lock.yaml` 为安装事实，ADR 只锁定主版本。

| 层次             | 位置或工具                                        | 责任                                                                                                   |
| ---------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 通用组件运行时   | Ant Design v6                                     | Button、Form、Table、Upload、TreeSelect、Modal、Drawer、Message、Notification 等通用行为与可访问性基础 |
| 项目视觉层       | `src/shared/theme/`、`ConfigProvider`             | 品牌色、字体、圆角、阴影、密度、状态语义和组件 Token                                                   |
| 跨功能布局与模式 | `src/shared/layout/`、后续 `src/shared/patterns/` | AppShell、PageHeader、FilterBar 等至少被两个真实功能共同使用的组合                                     |
| 功能实现         | `src/features/<feature>/`                         | 页面、字段、列定义、查询、权限和功能专用组合；事实来源是对应 SPEC                                      |

组件库负责通用行为和 API，不替代产品设计。页面的信息层级、任务顺序、空状态行动、响应式取舍和视觉方向仍需由 SPEC 或共享设计明确。

## 2. 依赖边界

### 默认允许

- `antd`：唯一默认运行时组件体系；
- `@tanstack/react-query`：服务端请求、缓存、失效和错误恢复；
- Tailwind CSS 4：页面布局、响应式编排和少量项目语义样式；
- Lucide React：Ant Design 图标不能表达时的补充通用图标源；同一操作内不得混用两套视觉不一致的图标；
- React Router：URL、导航和可恢复筛选状态。

### 默认禁止

- 不引入 HeroUI、MUI、Base UI、shadcn 默认组件或另一套完整 UI 体系；
- 不为同一语义维护两套 Button、Form、Table、Modal、Toast 或主题变量；
- 不采购或复制商业组件、模板和未经许可的设计资产；
- 不让 React Hook Form 与 Ant Design Form 同时管理同一表单状态；
- 不因为“可能会用到”而预装大组件或封装所有 Ant Design 组件。

`@ant-design/pro-components` 本身是免费开源候选，但截至 WI-002 验证时，其当前版本 peer dependency 只声明支持 antd v4/v5，没有声明支持 v6，因此不安装。出现真实 ProTable、EditableProTable 或 ProForm 需求且官方兼容关系明确后，另建工作项验证。

## 3. 直接使用与项目包装

普通、低风险的 Ant Design 组件可以在功能内直接使用，但必须位于项目 `ConfigProvider` 下并消费项目主题。只有满足以下任一条件才建立项目包装：

1. 至少两个真实功能需要完全相同的组合和默认行为；
2. 组件具有稳定的业务语义，例如“人员选择器”“项目状态标签”；
3. 必须集中处理权限、错误映射、埋点或可访问性契约；
4. 必须限制原组件过宽的 API，避免不同功能产生互斥用法。

包装组件不得简单复制 Ant Design 的全部 Props，也不得读取具体功能 Store、直接调用业务 API 或包含某个功能专属权限判断。删除或改变公共契约前，要检索全部调用方并在 work-item 中记录迁移方式。

## 4. Theme Token 与视觉

- 全局与 Component Token 定义在 `src/shared/theme/`，由根 `ConfigProvider` 统一注入；
- 页面和自定义区域优先使用语义色，例如画布、正文、品牌、成功、警告和危险，不在功能代码中散落近似色；
- 组件内部定制优先使用 Ant Design 的全局 Token、Component Token 与 v6 公开 `classNames/styles`；
- 禁止依赖生成类名、内部 DOM 层级或大范围 `!important` 覆盖；
- Tailwind 主要负责页面 Grid、Flex、间距和响应式布局，不重新实现 Ant Design 组件状态；
- 新增颜色、字号、阴影、圆角或密度档位前，先确认已有 Token 无法表达；
- 通用动效在 `prefers-reduced-motion` 下应缩短或关闭。

当前项目主题是可生产的中性基线，不等于 A/B/C 三个原型方向已经选定。最终登录和业务页面视觉必须在对应 SPEC 中确认后实现。

## 5. 表单模式

- Ant Design Form 是页面编辑值、脏状态、提交状态和字段错误的唯一前端状态所有者；
- 必填、长度和基础格式可在前端即时提示；Spring Boot 仍是业务规则、权限和唯一性判断的最终权威；
- 后端字段错误必须映射到具体 `Form.Item`，非字段错误进入表单级 Alert 或持久反馈；
- 异步提交期间防止重复提交，并保留用户修复错误所需的上下文；
- 成功后重置、停留或跳转由功能 SPEC 决定；
- 必填标记、帮助、错误和禁用原因必须有文字，不只依赖颜色；
- 日期、文件和选择器使用稳定提交值，显示文案与提交值分离；
- Upload 必须明确 `valuePropName`、规范化和上传责任，不能让 Form 把文件数组误传为普通 `value`。

## 6. 表格模式

- 基础表格采用 Ant Design Table，服务端数据与缓存采用 TanStack Query；
- 服务端分页、排序和筛选使用受控状态，不在已经分页的数据上伪装全量客户端排序；
- 可分享或浏览器返回后应恢复的筛选条件写入 URL；
- 行选择使用稳定业务标识，不使用页内数组下标；
- 加载、空、错误、无权限、无结果和部分选择必须显式呈现；
- 目录型表格默认每页展示 `10` 条，保留 `20`、`50` 条作为用户可选值；
- 用户增大每页条数后，表头、分页与页面上下文保持稳定，超出可视区的行只在表格主体内纵向滚动，不把整页拉长；
- 窄屏保留关键列，必要时只让表格容器横向滚动，不让整个页面产生横向溢出；
- 功能专用列与操作留在 `features`，出现两个真实消费者且契约稳定后再提取共享模式。

大规模虚拟滚动、树表、甘特图、可编辑表格和超大导出不是当前基础承诺；出现真实需求时单独验证性能、可访问性和退出方式。

## 7. 浮层、反馈与页面状态

- 根 Provider 使用 Ant Design `App`，Message、Notification 和 Modal 优先从上下文 API 获取，避免静态调用丢失主题或语言环境；
- Modal 与 Drawer 必须支持 Escape、合理的初始焦点和关闭后的焦点恢复；
- Toast 只用于短暂、非阻塞结果；需要用户决策或修复的问题保留在页面或浮层中；
- 每个主要数据区域都要评估首次加载、局部刷新、空数据、搜索无结果、请求失败、无权限、禁用原因和操作反馈；
- Skeleton 应保持大致布局，不让用户误以为已有可操作内容。

## 8. 响应式、键盘与无障碍

- 页面设计目标最小宽度为 320px；当前本地证据覆盖 390px 窄屏和桌面视口；
- 导航在窄屏使用可关闭 Drawer，并支持 Escape 与焦点恢复；
- 所有可操作元素必须有可见焦点；图标按钮必须有可访问名称；
- 全局快捷键不得劫持 Input、Textarea、Select 等编辑控件的方向键；
- 页面语言声明为 `zh-CN`；
- 颜色对比、屏幕阅读器、严格 CSP 和公司指定 Chrome/Edge 版本仍需在共享环境继续验证。

## 9. 原型与正式页面边界

`/component-lab` 只在 Vite 开发模式注册，是可丢弃的组件与视觉验证页：

- 原型数据、字段、文案和页面结构不构成产品事实；
- 原型不得直接升级为正式登录或业务页面；
- 正式页面先完成对应 SPEC，再复用已验证的 Token 和通用模式重写；
- 视觉方向确定后可以删除原型，不要求维持向后兼容。

## 10. 测试与变更门

公共组件、Theme Token 或共享模式变化至少需要：

- TypeScript 类型检查；
- Oxlint 零警告；
- Prettier 检查；
- 对关键事件、状态或键盘行为编写 Vitest/RTL 测试；
- 生产构建成功并记录体积提示；
- 涉及浮层、表格、表单或响应式布局时，至少一次真实浏览器操作验证。

统一执行：

```bash
pnpm web:check
```

影响多个功能或改变基础依赖时，需要更新本规范并评估新 ADR；升级 antd 主版本必须新建独立工作项。

## 11. 已验证能力与剩余风险

WI-002 已验证 AppShell、Form、Table、Upload、TreeSelect、Select、DatePicker、Steps、Timeline、Modal、Drawer、Message、Notification、Descriptions、Statistic，以及登录、列表、编辑三类页面组合。桌面和 390px 窄屏无页面级横向溢出，基础键盘和浮层行为通过，自动化检查与生产构建通过。

尚未关闭：主入口原始 chunk 大于 500 kB 的构建提示、公司实际浏览器版本、屏幕阅读器、严格 CSP、甘特图、超大数据集和正式上传链路。这些风险随真实功能 SPEC 和性能预算逐项验证，不阻塞 Ant Design v6 作为当前默认组件体系。
