# 前端应用

这是“项目全生命周期管理系统”的 React 单页应用。当前包含本地工程概览和 Ant Design v6 可丢弃验证页，尚未实现正式登录或其他业务功能。

## 已确认的前端路线

- React 19 + TypeScript 6 + Vite 8；
- Ant Design v6 是唯一默认运行时组件体系，当前精确锁定 `antd@6.6.1`；
- `ConfigProvider` + Ant Design `App` 统一中文环境、项目 Theme Token 和反馈上下文；
- Tailwind CSS 4 负责页面布局、响应式编排和少量语义样式；
- TanStack Query 负责服务端状态，基础表格使用 Ant Design Table；
- 基础表单使用 Ant Design Form，业务规则仍以后端为准；
- Vitest + React Testing Library 负责组件与逻辑测试；
- Oxlint + Prettier 负责静态检查与格式。

不并用 HeroUI、MUI、Base UI、shadcn 默认组件或第二套完整 UI 体系。`@ant-design/pro-components` 当前版本未声明兼容 antd v6，因此没有安装。正式边界见[前端共享组件规范](../../docs/technical/designs/frontend/FRONTEND_COMPONENT_STANDARD.md)。

## 本地命令

从项目根目录执行：

```bash
pnpm web:dev
pnpm web:check
```

也可以在本目录执行：

```bash
pnpm dev
pnpm check
```

开发服务器固定在 `http://127.0.0.1:5173`，并将 `/api` 转发到 `http://127.0.0.1:8080`。完整启动顺序见[本地开发环境说明](../../infrastructure/local/README.md)。

## 页面

| 路径                                  | 用途                                     | 环境       |
| ------------------------------------- | ---------------------------------------- | ---------- |
| `/`                                   | 显示本地骨架、后端连通状态和下一步边界   | 开发与生产 |
| `/component-lab?variant=A&scene=list` | Ant Design v6 三视觉方向与三页面场景验证 | 仅开发环境 |

验证页参数：

- `variant=A|B|C`：A「秩序工作台」、B「现代画布」、C「高密度控制台」；
- `scene=login|list|form`：登录、工作计划列表、工作计划编辑。

验证页不是产品首页。它的数据、字段、文案和结构不构成业务事实，也不会作为生产路由打包；正式页面必须先有对应 SPEC。

## 源码边界

```text
src/
├── app/                    # Provider、路由和启动装配
├── api/client/             # HTTP 客户端与统一错误边界
├── features/               # 按功能组织页面、查询、表单和测试
├── shared/layout/          # AppShell 与跨页面布局
├── shared/theme/           # Ant Design 项目 Theme Token
└── test/                   # 测试环境装配
```

- 单功能页面、字段、状态和业务规则留在对应 `features` 与 SPEC；
- 普通 Ant Design 组件可以直接使用，不逐个建立空包装；
- 只有两个以上真实功能需要共同遵守的组合，才建立 `shared/patterns`；
- Theme Token 变化进入 `shared/theme`，禁止在功能页面依赖 Ant Design 内部 DOM 或生成类名；
- URL 与导航归 Router，服务端数据归 Query，编辑值归 Ant Design Form；
- 不在 `app`、路由或全局 Store 中复制服务端业务状态。

## 当前验证边界

WI-002 已验证登录、列表、编辑三类组合，以及 Form、Table、Upload、TreeSelect、Steps、Timeline、Modal、Drawer 和反馈组件；桌面和 390px 窄屏、基础键盘操作、自动化检查与生产构建通过。

生产构建仍有主入口原始 chunk 大于 500 kB 的提示。原型已不进入生产构建；后续在正式功能路由出现后建立性能预算并继续拆包。公司实际浏览器版本、屏幕阅读器、严格 CSP、甘特图、超大数据集和正式上传链路尚未验证。
