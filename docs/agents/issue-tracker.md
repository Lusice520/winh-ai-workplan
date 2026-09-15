# 项目任务事实源

> 状态：已生效  
> 适用范围：所有正式研发请求、work-item、缺陷与 GitLab Merge Request  
> 关联规则：[CONTRIBUTING.md](../../CONTRIBUTING.md)、[工作项说明](../development-testing/work-items/README.md)

## 1. 唯一事实源

本项目的正式研发任务以 `docs/development-testing/work-items/WI-xxx-*.md` 为唯一事实源。每个 work-item 必须说明负责人、分支、允许修改范围、依赖、验收与验证证据。

GitLab Merge Request 负责代码评审、流水线与合并记录；在 GitLab 远程建立前不得伪造远程 Issue 或 MR。GitLab Issue 如在后续启用，只保存指向本仓库 work-item 的链接和必要讨论，不复制完整任务正文。

不得使用 `.scratch/`、独立本地 ticket 目录或工具私有记忆作为第二个任务事实源。

## 2. Matt 工程流程映射

| Matt 动作    | 本项目的落点                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| `to-spec`    | 生成实现侧补充时，回写对应的正式 SPEC、共享设计或 ADR；不替代 `docs/requirements/` 的 PRD/SPEC 事实源      |
| `to-tickets` | 每张可独立实施的 ticket 对应一个 `WI-xxx` 文件；依赖写入“前置条件与依赖”，不得另建并行 ticket 列表         |
| `implement`  | 只处理状态为“进行中”且 Triage 已达到 `ready-for-agent` 的 work-item；提交、推送、MR 和部署仍需用户明确授权 |
| `triage`     | 对尚未形成 work-item 的请求进行准入判断，或说明已有 work-item 为什么因事实/人工前置条件暂停                |

一个多阶段功能可有多个 work-item，但每个 work-item 只负责一个可验证的改动范围，并在“前置条件与依赖”中写明阻断边。

## 3. Triage 与实施状态

Triage 词汇的定义见 [triage-labels.md](./triage-labels.md)。它回答“请求是否准备好进入或继续研发”；work-item 的“待开始 / 进行中 / 待评审 / 已完成 / 已阻塞”回答“已立项工作实施到哪一步”。两者不可互相替代。

如果已有 work-item 但尚未满足开工条件，可在元信息中增加可选的 `Triage 状态` 行，并在“前置条件与依赖”中说明关闭条件。达到 `ready-for-agent` 后才将 work-item 进入“进行中”。

## 4. 需要人工或外部动作时

GitLab 创建、保护规则、CI 密钥、生产环境、VPN、证书、真实数据库凭据和部署都属于人工或外部系统动作。相关 work-item 应标记为 `ready-for-human` 或 `needs-info`，保留已完成的本地证据，并明确谁负责关闭该前置条件。
