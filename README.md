# 项目全生命周期管理系统

本仓库用于规划、设计、开发和交付“项目全生命周期管理系统”。系统面向公司内部员工，主系统通过公司 VPN 访问，首期采用本系统自建账号。

> 当前阶段：正式本地开发。WI-006 账号、组织与会话已验收；WI-007 菜单、角色、动态导航和服务端权限决策已完成实际授权、独立复核与撤销验证，初始化访问桥接已删除。CRM、售前、需求池及合同/文件/交接的本地进展见下方记录；整个系统仍在持续实施，不能将本地模块验收视为生产交付。

> 2026-09-12 首批业务进展：`WI-008` 已实现 CRM、售前协作和需求池闭环，包括真实处理记录、独立验证、敏感投入授权和 V5/V6 迁移。已通过真实 PostgreSQL 与桌面/窄屏浏览器验证，详见 [本批验收](docs/development-testing/accept/ACCEPT-008-business-local.md)。整个系统继续接续合同、交付准入、交付基线及经营财务；不能将本批成果视作全系统完成。

> 2026-09-13 接续进展：`WI-009` 已实现合同签署后归档、实际文件版本、节点更正历史、DG-01 移交包和提前开工授权/承诺/实际台账，V7–V9 已在本地 PostgreSQL 应用。独立审批、超限、失败回滚、桌面/窄屏流程见 [本批记录](docs/development-testing/accept/ACCEPT-009-contract-files-local.md)。DG-01 通过后主阶段仍为售前。

> 2026-09-13 交付基线进展：`WI-010` 已完成发布模板与规则、DG-02 九组检查与独立评审、团队/阶段/里程碑/清单/工作包/计划/预算、责任交接和成组范围变更的本地验证。合成项目经两轮评审形成 V1，后续预算、范围与交接延续至 V4；保留原对象及需求身份，已完成工作不被新范围覆盖。V1–V17 全新空库迁移、49 项后端及 37 项前端检查通过，详见 [本批验收](docs/development-testing/accept/ACCEPT-010-delivery-baseline-local.md)。交付执行、统一消息待办、经营财务及生产交付继续实施。

> 2026-09-13 执行进展：`WI-011` 已接入同一项目的阶段实际、清单分批到货/安装/独立验收、里程碑验证、冲回重开和历史附件。合成项目完成真实多账号流程，55 项后端与 40 项前端检查、零表至 V18 迁移及重启回读通过；详见 [执行规格](docs/requirements/specs/project_execution_spec.md)。任务分解、周计划/工时、报告例会、统一消息和经营财务继续接续。

## 快速入口

- [项目文档总入口](./docs/README.md)
- [团队开发协作规范](./CONTRIBUTING.md)
- [GitLab 协作基线设置](./docs/development-testing/plans/GITLAB_SETUP.md)
- [业务需求文档 BRD](./docs/requirements/BRD.md)
- [产品需求文档 PRD](./docs/requirements/PRD.md)
- [单功能 SPEC 模板](./docs/requirements/specs/SPEC_TEMPLATE.md)
- [总体技术方案](./docs/technical/TECHNICAL_SOLUTION.md)
- [架构决策记录 ADR](./docs/technical/adr/README.md)
- [前端共享组件规范](./docs/technical/designs/frontend/FRONTEND_COMPONENT_STANDARD.md)
- [开发、测试与验收资料](./docs/development-testing/README.md)
- [本地启动说明](./infrastructure/local/README.md)

## 当前技术基线

| 范围     | 已确认方案                                                                                  |
| -------- | ------------------------------------------------------------------------------------------- |
| 前端     | React + TypeScript + Vite 单页应用；Ant Design v6 + 项目 Theme Token，Tailwind CSS 负责布局 |
| 后端     | Java 21 + Spring Boot 3.x                                                                   |
| 应用形态 | 模块化单体 + 独立后台任务进程                                                               |
| 数据库   | PostgreSQL                                                                                  |
| 文件存储 | S3 兼容对象存储，私有部署优先 MinIO                                                         |
| 访问方式 | 公司内网部署，员工通过公司 VPN 访问                                                         |
| 身份     | 系统自建员工账号                                                                            |
| 预计用户 | 60—100 人                                                                                   |

本节只是项目入口摘要；正式技术结论、适用边界和待确认事项以[总体技术方案](./docs/technical/TECHNICAL_SOLUTION.md)及对应 ADR 为准。

> 2026-09-13 任务进展：`WI-012` 已完成原工作包任务新建/接纳、个人成果、独立核验、取消重开与历史文件。原需求任务保留同一 ID，完成后仍由原需求独立关闭。后端 61 项、前端 43 项、V1–V20 新库与服务重启读回通过；详见 [任务验收](docs/development-testing/accept/ACCEPT-012-delivery-tasks-local.md)。周计划/工时、报告例会、消息与经营财务继续。

> 2026-09-13 收入进展：`WI-013` 已完成月度预测版本、PMO 填报与营销独立确认、整笔冲销、来源资料和正式职责交接。按月份/币种分别汇总，保留原预算入口。后端 69 项、前端 49 项、零表至 V21 及后端/资料存储重启回读通过；详见 [收入验收](docs/development-testing/accept/ACCEPT-013-income-local.md)。回款、开票、付款/采购/分包、报告与其他系统域继续接续。

## 本地启动

项目提供了 macOS 本地运行时入口。首次在项目根目录准备 Node.js 24.19.0 与 Java 21：

```bash
./scripts/development/bootstrap-local-runtime.sh
./scripts/development/local-runtime.sh -- pnpm install --frozen-lockfile
./scripts/development/local-runtime.sh -- pnpm local:check
```

随后分别在两个终端启动；包装脚本会使用项目内的运行时，不依赖电脑上是否已安装对应版本：

```bash
./scripts/development/local-runtime.sh -- pnpm backend:dev
./scripts/development/local-runtime.sh -- pnpm web:dev
```

- 本地首页：`http://127.0.0.1:5173/`
- 组件实验页（仅开发环境）：`http://127.0.0.1:5173/component-lab?variant=A&scene=list`
- 后端健康检查：`http://127.0.0.1:8080/actuator/health`

`.local-tools/` 只保存当前机器下载的运行时，已被 Git 忽略，不能放入密钥、配置或业务数据。端口、环境变量和当前不启动的依赖见[本地开发环境说明](./infrastructure/local/README.md)。

## 项目目标目录

下面是整个项目的长期目录规划。已经存在的目录继续维护；标注“工程阶段建立”的目录在真正进入对应工作时创建，不提前建立空壳。

```text
winh-ai-workplan/
├── README.md                         # 项目总入口、目录说明和当前状态
├── AGENTS.md                         # 项目级 AI 协作入口
├── CONTRIBUTING.md                   # 三人开发、Git 与评审流程
├── CLAUDE.md                         # Claude Code 规则适配入口
│
├── docs/                             # 正式项目文档
│   ├── README.md                     # 文档体系入口
│   ├── requirements/                 # 业务与产品需求
│   ├── technical/                    # 总体技术方案、ADR 与跨功能共享设计
│   ├── development-testing/          # 开发计划、任务、Bug、测试与验收
│   └── history-archive/              # 已被替代但仍需追溯的资料
│
├── apps/                             # 应用代码
│   ├── web/                          # React + TypeScript 前端
│   └── backend/                      # Spring Boot 模块化单体与 Worker
│
├── infrastructure/                   # 部署与运行配置
│   ├── local/                        # 本地开发环境
│   ├── environments/                 # 开发、测试、生产的非密钥配置模板
│   ├── deploy/                       # 公司内网部署与发布配置
│   └── monitoring/                   # 日志、指标、告警和运行检查
│
├── scripts/                          # 可重复执行的辅助脚本，按需建立
│   ├── data/                         # 数据初始化、导入和校验
│   ├── development/                  # 本地开发辅助
│   └── operations/                   # 部署、备份、恢复和运维辅助
│
├── tests/                            # 跨应用测试，按需建立
│   └── e2e/                          # 前后端端到端与关键流程自动化测试
│
├── outputs/                          # 汇报稿、演讲稿、预览和阶段性交付副本
├── .agents/                          # AI 协作规则与非正式工作上下文
├── .trae/rules/                      # Trae IDE 项目规则适配入口
├── .gitlab/                          # GitLab 合并请求模板等仓库配置
├── .githooks/                        # Git 自动检查，有实际检查时按需建立
├── .editorconfig                     # 跨编辑器的基础格式约定
├── .gitattributes                    # Git 行尾和二进制文件规则
├── .gitignore                        # 不进入版本库的文件规则
└── .env.example                      # 环境变量示例，不包含真实密钥
```

## 目录职责

| 位置              | 中文职责        | 内容边界                                                                |
| ----------------- | --------------- | ----------------------------------------------------------------------- |
| docs/             | 正式文档        | 业务、产品、技术、开发测试和历史资料；不放代码或运行数据。              |
| apps/web/         | 前端应用        | React 页面、路由、状态管理、通用组件和前端自动化测试。                  |
| apps/backend/     | 后端应用        | Spring Boot 模块化单体、HTTP 接口、业务模块、数据库迁移和 Worker 入口。 |
| infrastructure/   | 基础设施与部署  | 环境配置模板、构建部署、网络入口、监控和运行配置；不放真实密钥。        |
| scripts/          | 辅助脚本        | 可重复执行的数据、开发和运维脚本；一次性手工记录不放这里。              |
| tests/e2e/        | 跨应用测试      | 验证浏览器、后端、数据库和文件存储协作的关键用户流程。                  |
| outputs/          | 导出产物        | 汇报材料、预览、生成结果和交付副本；不是正式事实来源。                  |
| .agents/          | AI 协作内部资料 | 项目规则和工作上下文；不属于业务或技术正式文档。                        |
| .trae/、CLAUDE.md | AI 工具适配     | 将 Trae 和 Claude Code 接入根目录 AGENTS.md，不维护平行规则。           |
| .gitlab/          | GitLab 仓库配置 | 合并请求模板和后续平台协作配置；不保存凭据。                            |

## 文档、代码和测试的边界

1. BRD、PRD、SPEC、总体技术方案、ADR、测试用例和验收记录放在 docs。
2. React、Java、数据库迁移和自动化测试代码放在 apps；单元测试和模块集成测试应靠近对应应用代码。
3. 根目录 tests 只保存跨前后端的端到端测试，不重复 apps 内部的单元测试。
4. 数据库迁移跟随后端版本，放在 apps/backend 内，不另建脱离应用版本的顶层 database 目录。
5. 用户上传文件、PostgreSQL 数据、MinIO 对象、日志和备份属于运行数据，存放在部署环境的独立存储卷或 NAS，不进入项目仓库。
6. 密码、令牌、证书私钥和生产配置不得写入 README、源码或提交到版本库；仓库只保留示例和非密钥配置模板。

## 开发资料的追溯关系

```text
BRD → PRD → SPEC（含功能详细设计）→ work-item → 代码与自动化测试 → test-case → accept
                         │
                         └──────────────→ issue（发现 Bug 时）

PRD / SPEC → 总体技术方案 → ADR / 共享设计 → apps / infrastructure
```

- work-item 是开发任务和需求补充，位于 docs/development-testing/work-items。
- issue 只表示 Bug，位于 docs/development-testing/issues。
- test-case 是人工或可复用测试场景，位于 docs/development-testing/test-cases。
- accept 是验收范围、证据和结论，位于 docs/development-testing/accept。

## 当前已存在与后续建立

| 目录或文件                                | 当前状态                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| README.md、AGENTS.md、CONTRIBUTING.md     | 已建立项目入口和三人协作规则                                                                                  |
| CLAUDE.md、.trae/rules/                   | 已建立 Claude Code 与 Trae 的规则适配入口                                                                     |
| docs/                                     | 已建立并完成目录整理                                                                                          |
| outputs/                                  | 已存在，用于阶段性导出产物                                                                                    |
| .agents/                                  | 已存在，用于项目协作规则和工作上下文                                                                          |
| .gitlab/                                  | 已建立合并请求模板；平台保护规则待在公司 GitLab 配置                                                          |
| 本地 Git                                  | 已初始化 `main`；尚未创建初始提交、配置远程或推送                                                             |
| apps/web/                                 | 登录、组织与授权、CRM、售前、需求池、处理记录、合同、项目资料、移交、先行投入及交付基线均连接实际 API；`component-lab` 仅开发环境 |
| apps/backend/                             | Java 21 + Spring Boot 3.5 模块化单体、IAM/业务/交付基线模块、Flyway V1–V21、PostgreSQL、私有 S3 适配、会话与测试 |
| infrastructure/local/                     | 已建立本地端口、启动顺序、PostgreSQL 与环境边界说明；正式部署目录尚未建立                                     |
| scripts/                                  | 已建立本地运行时、PostgreSQL/S3 测试服务及 CRM/合同/移交/节点端到端验证脚本 |
| tests/e2e/                                | 尚未建立；首个跨前后端流程进入自动化验证时创建                                                                |
| .gitignore、.editorconfig、.gitattributes | 已建立忽略、格式和行尾基线                                                                                    |
| .env.example                              | 已建立当前本地端口示例；不包含密钥                                                                            |
| .githooks                                 | 尚未建立；有实际提交前检查时创建                                                                              |

## 当前根目录待整理项

- 项目全生命周期管理流程20260209.xlsx 是原始业务输入资料，后续确认其用途后移入 docs/requirements/references 或 history-archive。
- output/ 不是目标目录；应在确认没有独立内容后与 outputs/ 合并或清理。
- .scratch、.superpowers、.workbuddy、.gstack、.playwright-cli 是本地工具运行目录，不属于正式项目结构，已通过 .gitignore 排除，不作为需求、技术或交付事实来源。

## 当前完成边界与下一步

本地基础和第一个正式 IAM 垂直切片已完成实现：

1. 前端脚手架与 Ant Design v6 + 项目视觉层已经过 A/B/C 三方向实际验证；
2. Node、pnpm、Java、Spring Boot、项目本地 PostgreSQL 和主要依赖已锁定；
3. `apps/web`、`apps/backend` 与 `infrastructure/local` 已建立，登录、组织/部门、用户、会话、审计与 Flyway 已落入对应 Module；
4. 后端 Module/HTTP 测试、前端类型/Lint/格式/交互测试和生产构建已通过；浏览器登录页已回归验证；
5. 组织用户前端已按查询组合、组织目录、用户目录、组织表单、用户表单、用户详情和账号动作拆分 Module，运行时不再引用 Mock 数组；
6. 菜单管理、权限项目录、角色、数据范围、临时授权、动态导航和服务端权限决策由独立 `WI-007` 交付：V3/V4/V10 迁移、正式 `decide(...)`、动态导航、独立复核与跨账号浏览器授权闭环已通过；初始化访问桥接已删除，详见 `ACCEPT-007`。

`TC-006` 与 `TC-007` 的本地浏览器验收已关闭。后续业务模块接入同一套正式权限，保留原始对象与审计历史；现有 Mock 原型只作视觉参考，不构成实际业务验收证据。

公司 GitLab 远程、主分支保护和 CI 在三人开始并行编码前完成；实际主机、VPN 路由、域名、证书和对象存储等生产条件不阻塞本地开发，但必须在共享环境和部署前确认。
