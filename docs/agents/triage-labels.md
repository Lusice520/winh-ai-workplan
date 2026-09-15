# Triage 请求准入状态

> 状态：已生效  
> 适用范围：正式研发请求进入 work-item 前，以及已有 work-item 因缺少事实或人工动作暂停时  
> 关联规则：[项目任务事实源](./issue-tracker.md)、[工作项说明](../development-testing/work-items/README.md)

这些标签只服务于请求准入，**不等于** work-item 的实施状态，也不描述产品功能、用户账号或数据库状态。

| Triage 状态       | 清晰含义                                                           | 对 work-item 的处理                                           |
| ----------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| `needs-triage`    | 收到新的需求、问题或建议，但尚未判断优先级、范围、重复性或采用方式 | 通常不创建正式 work-item；先核对事实并给出处理建议            |
| `needs-info`      | 缺少 PRD/SPEC、验收、负责人、依赖、技术结论或外部条件              | 可以保留草稿 work-item，但不得开始代码；写明缺什么及由谁关闭  |
| `ready-for-agent` | 目标、事实来源、范围、依赖、负责人、验收与验证方式已明确           | 创建或继续正式 work-item；可进入“进行中”实施状态              |
| `ready-for-human` | 需要项目负责人、集成人员、IT 或安全人员做决定、配置或评审          | work-item 保留但暂停；代码不得以猜测方式绕过前置条件          |
| `wontfix`         | 已确认不做、被更合适方案替代，或请求已由现有能力满足               | 不创建正式 work-item，或将已有草稿明确取消/归档并链接替代依据 |

正式 work-item 的“待开始 / 进行中 / 待评审 / 已完成 / 已阻塞”仍遵循 [WORK_ITEM_TEMPLATE.md](../development-testing/work-items/WORK_ITEM_TEMPLATE.md)。当 work-item 为“已阻塞”时，才可额外使用 `needs-info` 或 `ready-for-human` 说明阻塞的性质。

后续如建立 GitLab 标签，可复用同名英文标签；GitLab 标签仅是可视化入口，不能覆盖本仓库 work-item 的正式内容和验收证据。
