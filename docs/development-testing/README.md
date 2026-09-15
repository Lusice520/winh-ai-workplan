# 开发、测试与验收

本目录承载需求进入实施后的工作资料，回答“如何做、如何测试、如何验收”。它不替代 BRD、PRD、SPEC 或技术设计中的正式事实。

| 目录 | 中文含义 | 放什么 |
|---|---|---|
| [plans](./plans/README.md) | 开发计划 | 迭代安排、开发计划、发布检查清单。 |
| [work-items](./work-items/README.md) | 开发工作项 | 从 SPEC 拆出的开发任务、需求补充和实施待办。 |
| [issues](./issues/README.md) | 缺陷问题 | Bug 的复现、影响、处理和回归记录。 |
| [test-cases](./test-cases/README.md) | 测试用例 | 功能、权限、异常、兼容和回归测试用例。 |
| [accept](./accept/README.md) | 验收资料 | 验收范围、记录、证据与结论。 |

团队分支、任务所有权、AI 使用和合并流程以项目根目录的 [CONTRIBUTING.md](../../CONTRIBUTING.md) 为准；GitLab 平台设置见 [GITLAB_SETUP.md](./plans/GITLAB_SETUP.md)。

建议关联关系：

SPEC → work-item → test-case → accept

issues 可在开发或测试阶段产生，必须关联到受影响的 SPEC、work-item 或验收项。
