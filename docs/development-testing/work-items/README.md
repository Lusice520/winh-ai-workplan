# 开发工作项

本目录存放从 SPEC 拆出的研发任务、需求补充和实施待办。

建议使用 `WI-001-<简短名称>.md` 命名，并从 [WORK_ITEM_TEMPLATE.md](./WORK_ITEM_TEMPLATE.md) 复制建立。

每个 work-item 必须写明唯一负责人、分支、允许修改范围、冲突区、依赖、契约影响、验收标准和验证方式。work-item 不记录 Bug，也不替代需求文档；分支和合并规则以根目录 [CONTRIBUTING.md](../../../CONTRIBUTING.md) 为准。

## 请求准入状态与 work-item 实施状态

两套状态服务于不同问题，不能互相替代：

| 记录           | 回答的问题                                             | 使用时机                                                         |
| -------------- | ------------------------------------------------------ | ---------------------------------------------------------------- |
| Triage 状态    | 这个请求是否信息充分、是否能进入或继续正式研发？       | 请求尚未形成 work-item，或 work-item 因缺少事实/人工动作而暂停时 |
| Work-item 状态 | 已经立项的研发任务处于开始、实施、评审、完成还是阻塞？ | work-item 创建后直到 MR 合并和验收完成                           |

Triage 的默认词汇为 `needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`，完整含义见 [`docs/agents/triage-labels.md`](../../agents/triage-labels.md)。正式 work-item 继续使用模板中的“待开始 / 进行中 / 待评审 / 已完成 / 已阻塞”等实施状态；不要把前者写成后者，也不要用后者掩盖尚未关闭的需求或人工前置条件。
