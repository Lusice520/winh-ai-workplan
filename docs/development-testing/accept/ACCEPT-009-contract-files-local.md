# WI-009 合同、文件与交付移交本地验收记录

2026-09-13；Lusice / 当前 Codex。WI-009 本地功能范围通过，整个系统目标继续。

已验证合同签署后主档、节点登记/完成/更正、当前签署件、补充变更、独立归档与退回重提；真实文件上传/修订/独立发布/下载/SHA-256；敏感权限、幂等、旧版本和存储失败恢复。节点更正保存原因及前后事实，误报撤销保留原证据，归档接收中冻结修改。

DG-01 按类型清单核验真实有效依据，独立评审形成不可变移交包；提前开工独立批准范围、限额及期限，支持承诺、部分实际、冲回、超限冻结、停止、收口和转正。浏览器中 1200 元承诺发生 300 元实际后，总占用仍为 1200 元，未核销 900 元。DG-01 通过后主阶段仍为售前，节点完成不生成财务实际。

| 验证 | 证据与结果 |
| --- | --- |
| 合同与文件 | [9 组 API](../../../outputs/verification/wi-009/api-checks.json)、[离线](../../../outputs/verification/wi-009/storage-offline.json)、[恢复](../../../outputs/verification/wi-009/storage-recovery.json)，实际浏览器上传到独立归档 |
| 节点更正 | [5 组 API](../../../outputs/verification/wi-009-nodes/api-checks.json)、[浏览器保存与回读](../../../outputs/verification/wi-009-nodes/browser-checks.json)，原因、金额、跨合同、版本、幂等、敏感权限、前后历史 |
| 移交与先行投入 | [7 组 API](../../../outputs/verification/wi-009-handover/api-checks.json)、[浏览器回读](../../../outputs/verification/wi-009-handover/browser-checks.json)，独立审批、源失效、并发上限、部分核销和转正 |
| 视觉 | draw-ui [合同校准](../../../outputs/design/wi-009/calibration-round-1/report/verification.json)、[移交校准](../../../outputs/design/wi-009/handover-calibration-round-2/report/verification.json)；桌面与 390px 截图已查看，历史抽屉已修复标题挤压正文问题 |
| 迁移与检查 | 空库 V1–V8 启动及 V9 升级；保留 12 个既有节点基线且不补造操作者；后端 20、前端 26 测试及类型/Lint/格式/构建通过；最终历史布局另经类型与构建检查 |

事实来源：[TC-009](../test-cases/TC-009-contract-files-handover.md)、CT-01 v0.2、DOC-01、HG-01、HG-02、业务共享契约。新增 contracts/files/handover、V7–V9 与独立敏感/审批权限、AWS S3 适配及可选存储配置。未改写已应用迁移，无 commit/push/部署；未配置存储时明确不可用。

保留边界：本地 S3Mock 不替代生产存储授权、扫描、备份、容量和分享隔离。公司真实授权组及模板制度尚未验收；DG-02、正式交付、经营财务等继续实施。前端现有公共依赖块超过 500 kB 的构建提示仍在，功能检查不作为性能验收。
