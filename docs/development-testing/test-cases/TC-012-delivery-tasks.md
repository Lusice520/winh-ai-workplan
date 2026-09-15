# TC-012：原工作包任务与独立成果

> WI-012 / SPEC-TASK-01；负责人 Lusice，实施与验证 Codex；2026-09-13；本地验证通过。

| 验收 | 实际结果与证据 |
|---|---|
| 原任务与新任务 | 需求 TASK 原 ID 接纳，来源和原需求链接不变；真实新建六项，其中一项手机新建。`outputs/verification/wi-012-tasks/fixture.json`、`browser-adoption.json`、`browser-mobile-create.json` |
| 个人实际和两轮验证 | 原任务 65%→第一轮完成→指定他人退回→第二轮 V2 完成→独立通过；原需求仍 IN_PROGRESS。`final.json`、`restart-readback.json`；多账号实际浏览器 |
| 原文件 | 两轮原版本在任务历史单独保留；V1 为历史、V2 为当前发布。浏览器从展开的第一轮打开文件，能读到两版本和发布意见；两次下载 SHA/字节一致。`files.json`、`mobile-file-history.png`、`restart-readback.json` |
| 校验与回滚 | 0.25 人天、跨包清单、父包完成状态、超出计划、早于阶段/未来日期、小数进度拒绝；经理不能代填个人实际，提交人不能自验，泛用入口不可绕过。`preflight.json`、`negative-checks.json`；失败后任务、父包和事件整体相等 |
| 父包完成门 | 任一未结或需复核任务阻止父包完成；两条 DONE 不自动改清单、里程碑、阶段或原需求。`checks.json`、`restart-readback.json` |
| 取消与重开 | 手机真实 CANCEL→REOPEN→CANCEL，各次有独立历史；7 条记录中有效 6，完成 2，取消 1 单列不计分母。`browser-cancellation.json`、`final.json` |
| 当前范围与责任 | 范围签名变化要求复核；旧 DONE 对下游返回 NEEDS_REVIEW；取消包/已有实际换阶段拒绝；责任交接保留原提交人，撤权后历史文件只返回受限数。6 项任务集成测试，来源/IAM/文件边界使用受控替身；未声称再次实施公司范围审批 |
| 并发与重放 | 同一真实 PostgreSQL 双版本并发 66/67 只有一笔成功、一笔 409、一条事件；原成功请求在恢复 65 后重放不覆盖后续进度。`concurrency.json`、`checks.json` |
| 数据库约束 | V12 旧规则最初阻断新任务，追加 V20 修正；真实新建通过，三种非法来源在 PostgreSQL CHECK 处拒绝并回滚。`postgres-source-check.txt` |
| 迁移与重启 | 原库和先前 V19 空库升级到 V20；另一精确零表库一次 V1–V20。主服务及 S3 重启后完整七任务、两轮文件原字节、原 V4 对象和既有执行一致。`restart-readback.json` |
| 页面与筛选 | 桌面 1522×1033、手机 390×844，无整页横向溢出；手机核验优先，侧栏宽度一致；关键词 URL 刷新恢复，真实新建/取消表单。`browser-mobile-final.json`、桌面/手机最终截图 |
| 本地文件启动 | 每次带入本机合成 S3 连接；额外 HTTP connector 通过本地初始化器实际约束回环。9090/9191 均为 127.0.0.1，原存储保留。`local-storage-listeners.txt` |

自动检查：后端全量 61 项通过（`.local-data/wi012-backend-full-v1.log`），最后 Work 完成查询改动另有 9 项关联检查通过（`wi012-task-tests-v3.log`）；前端最终 43 项 / 16 文件、类型、Lint、格式、构建通过（`wi012-web-compact-final.log`）。H2 的自动表结构不能证明 PostgreSQL Flyway 约束兼容，因此真实迁移与来源检查单独取证。

设计以 draw-ui 图像参考和五区域测量为依据，两轮真实元数据在 `outputs/design/wi-012/`。桌面第 2 轮与手机最终截图均实际查看。固定导航、真实长名称、两行标准及新增取消项使列表比图更高；不把几何偏差转成还原百分比。保留早期定位文字不符的自动化失败，以及 V20 前数据库拒绝、未带入文件连接的 503 记录。最终页面控制台另核对，不把历史开发重载消息计作当前业务错误。

公司试用、生产存储/部署、周计划/工时、报告例会、消息和经营财务继续，整个系统目标尚未完成。未执行 commit/push/MR/部署。
