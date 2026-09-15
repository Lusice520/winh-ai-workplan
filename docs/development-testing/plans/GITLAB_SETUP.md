# GitLab 协作基线设置

> 状态：本地 Git `main` 与协作规则已建立；初始提交、GitLab 远程项目、成员账号和平台保护规则待配置。

本清单用于把仓库中的团队约定落实成 GitLab 的强制控制。GitLab 项目负责人或 Maintainer 完成设置后，在本文件记录结果和日期。

## 1. 当前已知与待补信息

| 项目 | 当前状态 |
|---|---|
| 代码托管平台 | 公司 GitLab，已确认 |
| 默认分支 | `main` |
| 本地 Git | 已初始化，尚无提交和远程地址 |
| AI 工具 | Trae、Claude Code、Codex |
| GitLab 项目地址 | 待填写 |
| 三名成员 GitLab 用户名 | 待填写 |
| 首任集成负责人 | 待填写 |
| GitLab 版本与许可证 | 待确认，决定可强制的审批能力 |
| GitLab Runner | 待确认 |

成员信息由团队填写；三种 AI 不要求一一绑定，但每个工作项必须明确实际负责人和使用的工具。

| 成员 | GitLab 用户名 | 常用 AI | 主要责任范围 | 备用评审人 |
|---|---|---|---|---|
| 成员 1 |  |  |  |  |
| 成员 2 |  |  |  |  |
| 成员 3 |  |  |  |  |

## 2. 创建远程项目

- [ ] 在公司 GitLab 创建空项目，不自动生成另一套 README 或初始提交。
- [ ] 将项目地址填入上表。
- [ ] 本地仓库添加 `origin` 并首次推送 `main`。
- [ ] 三名成员加入项目；日常开发使用 Developer，集成负责人使用 Maintainer。
- [ ] 记录三名成员的 GitLab 用户名和首任集成负责人。

首次推送属于远程写入，执行前由项目负责人明确确认远程地址。

## 3. 保护 `main`

在 GitLab 的 Repository / Branch rules 中配置：

- [ ] `main` 为受保护分支。
- [ ] Allowed to push and merge 设为 No one，禁止直接推送。
- [ ] Allowed to merge 设为 Maintainers。
- [ ] Force push 保持关闭。
- [ ] 所有改动通过 Merge Request。
- [ ] 默认启用 squash，并在合并后删除来源分支。

参考：[GitLab Protected branches](https://docs.gitlab.com/user/project/repository/branches/protected/)

## 4. 合并请求评审

- [ ] 每个 MR 至少有一名非作者评审人。
- [ ] 启用“作者不能批准自己的 MR”；许可证支持时同时禁止提交者自行批准。
- [ ] 使用仓库中的默认 MR 模板。
- [ ] 发生 API、数据库、权限、共享组件或部署变更时，由集成负责人加入评审。
- [ ] CI 建立后，流水线成功才允许合并。

GitLab Free 无法强制的审批项仍作为团队规则执行；Premium/Ultimate 可配置 required approvals 和 Code Owner approval。

参考：[GitLab merge request approval rules](https://docs.gitlab.com/user/project/merge_requests/approvals/rules/)

## 5. CODEOWNERS

当前不创建带占位账号的 `CODEOWNERS`，避免 GitLab 产生无效审批规则。满足以下条件后再建立：

- [ ] 三名成员的 GitLab 用户名已确认。
- [x] `apps/web`、`apps/backend` 和 `infrastructure/local` 已经建立。
- [ ] 共享模块、数据库迁移和接口契约已有明确负责人。
- [ ] 团队确认哪些目录需要强制审批，哪些只需要提示负责人。

参考：[GitLab CODEOWNERS syntax](https://docs.gitlab.com/user/project/codeowners/reference/)

## 6. CI 最小质量门

代码骨架建立后，按以下顺序加入 `.gitlab-ci.yml`：

1. 文档链接和仓库结构检查；
2. 前端类型检查、Lint、单元测试和生产构建；
3. 后端 Java 编译与单元测试；
4. 登录阶段引入数据库后增加迁移校验；
5. 接口契约与跨模块集成测试；
6. 密钥扫描和依赖安全检查；
7. 出现稳定关键流程后增加端到端测试。

在 Runner、镜像源和公司内网访问方式确认前，不提交无法执行的占位流水线。

## 7. 三种 AI 的接入验证

分别在三个独立工作区开启新会话，并让工具只读回答以下问题：

1. 当前项目的规则唯一事实源是什么？
2. 修改文件前必须读取哪些资料？
3. 当前工作项的负责人、分支、范围和验收标准是什么？
4. 哪些内容属于高冲突区？
5. 交付时必须提供哪些验证证据？

验证前先检查三名成员的个人或全局规则，移除与项目规则冲突的分支、格式、安全或自动提交设置。三个工具都能基于 `AGENTS.md` 给出一致答案后，才视为规则接入完成。Trae CLI 的规则位置与 Trae IDE 不同；如团队实际使用 Trae CLI，需要另行增加对应适配，不能假设 IDE 规则自动生效。

## 8. 完成记录

| 检查项 | 完成人 | 日期 | 证据或说明 |
|---|---|---|---|
| 远程项目与成员 |  |  |  |
| `main` 保护 |  |  |  |
| MR 审批设置 |  |  |  |
| AI 规则接入验证 |  |  |  |
| 首个 CI 质量门 |  |  |  |
