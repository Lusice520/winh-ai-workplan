# 架构决策记录（ADR）索引

ADR 用于记录会长期影响系统结构、运行、安全、成本或演进的重要技术选择。2026-08-26 已根据已确认的私有部署＋VPN、自建账号、60—100 用户规模、Java 团队能力和后置集成边界，接受 ADR-001—ADR-007 作为总体实施基线；前端组件经两轮本地验证后接受 ADR-012，ADR-011 保留为被替代的历史决策。仍缺少恢复目标、容量与安全细则的事项保留为待建立 ADR，不能用“已选栈”掩盖上线条件。

返回：[总体技术方案](../TECHNICAL_SOLUTION.md)｜[技术文档入口](../README.md)

## 状态

| 状态 | 含义 |
|---|---|
| 提议中 | 已有候选和初步证据，等待验证或评审 |
| 已接受 | 决策已批准，可作为实施基线 |
| 已拒绝 | 候选经过评估但不采用，保留理由 |
| 已替代 | 后续 ADR 替代了该决策 |
| 已撤销 | 决策不再适用且没有直接替代 |

“待建立”是索引状态，不是 ADR 正文状态。

## ADR 清单

| 编号 | 主题 | 文件 | 当前状态 |
|---|---|---|---|
| ADR-001 | P1 应用运行形态与模块部署策略 | [ADR-001-application-runtime-shape.md](./ADR-001-application-runtime-shape.md) | 已接受 |
| ADR-002 | P1 前端与后端语言框架 | [ADR-002-web-and-service-framework.md](./ADR-002-web-and-service-framework.md) | 已接受 |
| ADR-003 | 结构化数据、事务、缓存与高可用边界 | [ADR-003-relational-data-transaction-and-cache.md](./ADR-003-relational-data-transaction-and-cache.md) | 已接受 |
| ADR-004 | 文件存储、检索与受控分享 | [ADR-004-file-storage-and-retrieval.md](./ADR-004-file-storage-and-retrieval.md) | 已接受；外网分享上线条件未关闭 |
| ADR-005 | 自建员工账号、认证与会话 | [ADR-005-local-identity-authentication-and-session.md](./ADR-005-local-identity-authentication-and-session.md) | 已接受；MFA 等安全细则待定 |
| ADR-006 | 业务事件、后台任务与可靠投递 | [ADR-006-reliable-business-events-and-jobs.md](./ADR-006-reliable-business-events-and-jobs.md) | 已接受 |
| ADR-007 | 私有部署、VPN 与外网分享访问边界 | [ADR-007-private-network-deployment-and-access.md](./ADR-007-private-network-deployment-and-access.md) | 已接受；实际网络与安全实施待验证 |
| ADR-008 | NAS 归档接入与不可变快照 | P3 前建立 | 待建立 |
| ADR-009 | 可观测性、备份、灾备与保留 | 需先确认 SLA、RPO、RTO、保留期和运行责任 | 待建立 |
| ADR-010 | 规则、模板与状态流转实现 | 需先完成关联 SPEC 与配置责任边界 | 待建立 |
| ADR-011 | 前端组件源码所有权与交互底座 | [ADR-011-frontend-component-source-and-primitives.md](./ADR-011-frontend-component-source-and-primitives.md) | 已替代；历史结论由 ADR-012 接替 |
| ADR-012 | Ant Design v6 默认组件体系与项目视觉层 | [ADR-012-ant-design-v6-component-system.md](./ADR-012-ant-design-v6-component-system.md) | 已接受；WI-002 本地验证通过 |

## 何时必须写 ADR

- 引入或替换语言框架、数据库、缓存、队列、搜索、文件存储或运行平台；
- 将逻辑模块拆成独立网络部署单元，或重新合并；
- 确定身份、外网访问、文件分享、NAS、财务等关键 seam 和 Adapter；
- 确定会影响数据迁移、兼容、恢复或供应商退出的重要格式与协议；
- 接受与已确认安全/NFR 原则存在明显取舍的方案；
- 推翻本总体技术方案中的评估基线。

局部代码风格、可逆实现细节和不会影响其他模块的短期选择不需要 ADR。

## 文件命名

```text
ADR-<三位编号>-<英文短名>.md
```

例如：`ADR-001-application-runtime-shape.md`。

## ADR 模板

```markdown
# ADR-NNN：决策标题

> 状态：提议中 / 已接受 / 已拒绝 / 已替代 / 已撤销
> 日期：YYYY-MM-DD
> 决策人：
> 关联需求：
> 关联验证：

## 背景与问题

说明必须做决定的事实、约束和不确定性。

## 决策驱动因素

- 可验证的业务、技术、安全、运维和成本因素

## 候选方案

### 方案 A

适用条件、优点、缺点、风险、退出方式。

### 方案 B

适用条件、优点、缺点、风险、退出方式。

## 验证证据

记录原型、压测、安全验证、恢复演练、团队评估、许可和总拥有成本。

## 决策

选择什么、适用范围、版本和不适用范围。

## 后果

### 正向后果

### 负向后果与控制

## 迁移与回退

## 复审触发条件
```

## 维护规则

1. ADR 记录当时事实，不通过改写历史来伪装一直正确；变化时新建 ADR 并标记替代关系。
2. 已接受 ADR 必须回写[总体技术方案](../TECHNICAL_SOLUTION.md)的选型表和相关章节。
3. 候选产品必须记录版本、许可证、生命周期、安全更新和退出路径。
4. 不用“团队偏好”代替部署、容量、恢复、安全或成本证据。
