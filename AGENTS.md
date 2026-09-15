# 项目 AI 协作入口

本文件是 Trae、Claude Code、Codex 共用的项目级 AI 规则唯一事实源。工具专用入口只负责加载本文件，不复制规则正文。

## 每次任务的必读顺序

1. 新会话先读 `README.md`，确认项目阶段和目录边界。
2. 任何文件修改前读 `CONTRIBUTING.md`，确认分支、任务所有权、冲突区和合并流程。
3. 按任务读取正式事实：
   - 业务与产品：`docs/requirements/` 中的 BRD、PRD、对应 SPEC；
   - 功能实现：对应 SPEC 中的功能详细设计；
   - 跨功能技术约束：`docs/technical/` 中的总体技术方案、对应 ADR 或共享设计；
   - 开发执行：对应 work-item、issue、test-case 或 accept。
4. 修改前检查当前 Git 分支和工作区状态；只处理当前任务范围，保留并报告不属于本任务的现有改动。
5. 缺少对应 SPEC、work-item 负责人或验收标准，并且自行补造会改变产品或技术边界时，先停止实现并报告缺口。

完成条件：能够说清本任务的事实来源、负责人、允许修改范围、验收标准和验证方式后，才开始修改。

## 事实与边界

- `docs/requirements/` 是业务和产品事实源；实现不得反向修改需求来迁就代码。
- 单功能详细设计与该功能的需求、交互和验收共同维护在对应 SPEC；不再建立平行的功能 DES。
- `docs/technical/` 是总体技术基线；跨功能复用约束进入 `technical/designs/`，重大取舍进入 ADR。
- `docs/development-testing/` 管理实施、缺陷、测试和验收，不替代上游事实。
- `docs/history-archive/`、`outputs/`、AI 对话、工具记忆和本地草稿只用于参考，不构成当前正式结论。
- `.agents/memory/` 只保存可丢弃的工作上下文；长期有效结论必须回写到正确的正式文档。

## 多人并行约束

- 一个 work-item 只有一个负责人、一个开发分支和一个主要工作区；三个人不得让 AI 同时操作同一个物理工作目录。
- 文件和模块范围以 work-item 为准。需要扩大范围时，先更新 work-item 并与受影响负责人协调。
- 根构建配置、依赖版本、认证权限、公共接口、数据库迁移、共享前端组件、CI 和部署配置属于高冲突区，按 `CONTRIBUTING.md` 串行协调。
- 共享分支保留他人提交历史；禁止强推、改写他人提交或用破坏性命令消除冲突。

## 修改与交付

1. 优先做满足验收标准的最小完整改动，同时补齐直接相关的测试和文档。
2. 密码、令牌、Cookie、私钥、生产配置以及未脱敏的客户或员工数据不得进入仓库、日志、截图或 AI 上下文。
3. 执行与改动直接相关的检查；无法执行时，在交接和合并请求中列出未验证项、原因和风险。
4. 交付必须说明：修改内容、关联 WI/SPEC/ADR 或共享设计、API/数据库/配置影响、验证证据、剩余风险。
5. 本地修改和验证在当前任务授权内进行；commit、push、创建或合并 MR、部署等动作按用户明确指令执行。

## 详细规则入口

- 团队开发与 Git 流程：`CONTRIBUTING.md`
- 需求与文档规则：`.agents/rules/requirements-docs.md`
- GitLab 初始化与保护设置：`docs/development-testing/plans/GITLAB_SETUP.md`
- 工作项模板：`docs/development-testing/work-items/WORK_ITEM_TEMPLATE.md`

## Agent skills

### Issue tracker

正式任务以 `docs/development-testing/work-items/WI-xxx-*.md` 为唯一事实源；GitLab Merge Request 只记录评审和合并证据。详见 [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md)。

### Triage labels

使用 `needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix` 作为请求准入状态；它们不替代 work-item 的实施状态。详见 [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md)。

### Domain docs

采用前后端分开的阅读导航：根目录 [`CONTEXT-MAP.md`](CONTEXT-MAP.md) 指向 `apps/web/CONTEXT.md` 与 `apps/backend/CONTEXT.md`；正式需求、ADR 和共享设计仍以 `docs/` 下的原文件为准。详见 [`docs/agents/domain.md`](docs/agents/domain.md)。
