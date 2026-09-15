# 本地开发环境

这里记录前后端在开发机上的共同运行约定。账号、权限与业务记录使用项目本地 PostgreSQL；文件通过私有 S3 适配器传输。本说明不包含真实账号、密码或密钥。Git 远程、提交和 Merge Request 不属于本地启动前置条件。

## 前置软件

- Node.js 24.19.0；
- pnpm 11.5.x；
- Java 21；
- 可访问 Maven Central 与 npm 包仓库的网络。

版本入口分别是根目录的 `.node-version`、`.java-version`、`package.json` 和 `pnpm-lock.yaml`。macOS 本地开发可通过项目脚本在 Git 忽略的 `.local-tools/` 中准备 Node 与 Java；这不会安装或替换系统级运行时。团队后续采用公司统一安装方式时，仍应保持相同的版本约束。

## 固定端口

| 服务            | 地址                          | 用途                                           |
| --------------- | ----------------------------- | ---------------------------------------------- |
| 前端开发服务器  | `http://127.0.0.1:5173`       | 页面与热更新；端口被占用时直接报错，不自动漂移 |
| 后端应用        | `http://127.0.0.1:8080`       | Spring Boot API 与健康检查                     |
| 前端 API 代理   | `http://127.0.0.1:5173/api/*` | 本地转发到后端，避免开发期跨域差异             |
| 本地 PostgreSQL | `127.0.0.1:54329`             | 仅本机回环监听的账号、权限和业务开发数据库 |
| 本地 S3 协议验证 | `127.0.0.1:9090` / `9191` | 可选的 S3Mock HTTP / HTTPS，仅用于合成文件验证 |

后端默认只监听本机回环地址，可通过 `SERVER_ADDRESS` 和 `SERVER_PORT` 覆盖；一旦修改端口，前端代理也必须同步调整。正式环境不使用 Vite 代理，由内网反向代理统一提供静态资源和 `/api` 路由；容器监听地址必须由部署配置显式指定。

## 首次安装与检查

在项目根目录执行：

```bash
./scripts/development/bootstrap-local-runtime.sh
./scripts/development/local-runtime.sh -- pnpm install --frozen-lockfile
./scripts/development/local-runtime.sh -- pnpm local:check
```

准备脚本只支持当前项目使用的 macOS Apple Silicon / Intel 架构；它从 Node.js 与 Oracle JDK 官方下载站获取运行时并在解压前校验 SHA-256。`local:check` 会执行前端类型检查、Lint、格式检查、测试和生产构建，以及后端 Maven 测试。

## 初始化本地 PostgreSQL 与管理员

首次登录与用户管理开发前，在项目根目录执行：

```bash
cp .env.example .env
# 打开 .env，只填写 APP_BOOTSTRAP_ADMIN_PASSWORD（至少 12 位），不要把它发到聊天、截图或提交中。
./scripts/development/bootstrap-local-postgresql.sh
./scripts/development/local-runtime.sh -- pnpm database:start
```

数据库二进制放在已忽略的 `.local-tools/`，数据库数据放在已忽略的 `.local-data/`。脚本只监听 `127.0.0.1`，并在空库创建 `winh` 本地开发用户和 `winh_workplan` 数据库；不修改系统级 PostgreSQL，也不要求 Docker。

`local-runtime.sh` 会在启动命令前以字面量方式加载项目根目录 `.env` 中的 `KEY=VALUE` 配置：支持成对引号，不执行其中的 shell 语法，且终端中已显式设置的环境变量优先。因此本地启动、检查和后端命令都应通过这个包装脚本运行。

常用命令：

```bash
./scripts/development/local-runtime.sh -- pnpm database:status
./scripts/development/local-runtime.sh -- pnpm database:stop
```

## 本地启动

打开两个终端并都位于项目根目录。

终端一先确保数据库已启动，再启动后端：

```bash
./scripts/development/local-runtime.sh -- pnpm backend:dev
```

终端二启动前端：

```bash
./scripts/development/local-runtime.sh -- pnpm web:dev
```

随后访问：

- `http://127.0.0.1:5173/login`：本地登录页；
- `http://127.0.0.1:5173/component-lab?variant=A&scene=list`：仅开发环境提供的 Ant Design v6 视觉验证页；
- `http://127.0.0.1:8080/actuator/health`：后端健康状态；
- `http://127.0.0.1:8080/api/system/status`：前后端连通契约。

## 合同与项目资料的本地验证

需要验证真实上传、版本发布和下载时，在第三个终端运行：

```bash
./scripts/development/local-s3.sh
```

脚本下载并校验固定版本的 Adobe S3Mock 5.2.2，只监听本机回环地址，合成文件保存在已忽略的 `.local-data/s3mock/`。启用测试服务后，通过以下固定本地入口启动后端；脚本每次带入回环地址和 `local-test-only` 测试占位值，避免重启漏掉文件连接。此入口只用于本机合成验证，不用于共享或生产部署：

```bash
./scripts/development/local-business-backend.sh
```

桶名默认 `winh-project-files`，区域默认 `us-east-1`。上传上限默认 20MiB；配置项见 `.env.example`。不配置存储时，其他业务仍可运行，上传/下载明确返回暂不可用。验证脚本 `contract-flow-check.mjs` 只允许本机地址，并创建显式标注的合成账号与业务；会话仅保存在忽略目录，不输出凭据。

S3Mock 5.2.2 的额外 HTTP connector 不继承 `server.address`。本地脚本从已校验 JAR 中取编译依赖，通过 `spring.factories` 注册本地初始化器，对 connector 显式绑定回环；两个端口已实测为 `127.0.0.1`。依赖和生成类仍在忽略目录，不修改原发布 JAR。依据：[5.2.2 官方配置源码](https://github.com/adobe/S3Mock/blob/5.2.2/server/src/main/kotlin/com/adobe/testing/s3mock/S3MockConfiguration.kt)。

S3Mock 用于协议集成，不验证生产存储认证、桶策略或容量。生产存储按 ADR-004 单独实施与验收。来源：[Adobe S3Mock](https://github.com/adobe/S3Mock)、[AWS SDK 端点配置](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/endpoint-config.html)。

## 当前边界

- WI-006 引入身份数据；WI-007 接入菜单和权限；WI-008 完成 CRM、售前、需求池的本地业务闭环；WI-009 接续合同、文件及交付移交。各批次的已验收与剩余项见对应 work-item/accept；
- 本地 S3 协议与服务重启已用合成文件验证；生产对象存储、NAS、飞书、VPN 路由、证书、监控与备份恢复仍需独立验收；
- `.local-tools/`、`.local-data/`、`.env`、密钥、证书、数据库数据和上传文件不得提交到 Git；`.local-tools/` 只可保存可重建的本机运行时。
