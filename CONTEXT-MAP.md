# 项目上下文导航

> 状态：已生效  
> 用途：帮助正式研发在前端、后端和跨端工作之间读取正确的正式事实；不替代 `docs/` 中的任何需求或技术结论。

## 全项目必读事实

- [全局领域词汇](./CONTEXT.md)
- [项目入口](./README.md)
- [协作与交付规则](./CONTRIBUTING.md)
- [业务与产品需求](./docs/requirements/README.md)
- [总体技术方案](./docs/technical/TECHNICAL_SOLUTION.md)
- [ADR 索引](./docs/technical/adr/README.md)
- [共享设计入口](./docs/technical/designs/README.md)
- [开发、测试与验收入口](./docs/development-testing/README.md)
- [任务事实源与 Triage 说明](./docs/agents/issue-tracker.md)

## 上下文

| 上下文     | 适用工作                                                                      | 阅读导航                                                              |
| ---------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 前端 Web   | React 页面、前端状态、HTTP 客户端、无障碍、浏览器测试、设计 Token             | [apps/web/CONTEXT.md](./apps/web/CONTEXT.md)                          |
| 后端与数据 | Spring Boot Module、认证、权限、OpenAPI、PostgreSQL、Flyway、Worker、集成测试 | [apps/backend/CONTEXT.md](./apps/backend/CONTEXT.md)                  |
| 跨端契约   | API、错误码、权限、审计、数据迁移和端到端流程                                 | 同时读取两个 Context，并以对应 SPEC 与 `docs/technical/designs/` 为准 |

对于所有正式代码修改，仍必须先确认对应 work-item 的负责人、允许修改范围、验收标准和验证方式。
