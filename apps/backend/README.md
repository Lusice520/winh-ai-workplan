# 后端应用

这是项目的 Spring Boot 模块化单体入口。当前只提供本地骨架与健康检查，不包含登录、数据库或业务模块实现。

## 当前接口

- `GET /api/system/status`：前后端连通检查。
- `GET /actuator/health`：运行健康检查。

## 本地运行

项目要求 Java 21，并通过 Maven Wrapper 固定构建入口。当前 macOS 本地开发建议从项目根目录使用本地运行时包装脚本：

```bash
./scripts/development/local-runtime.sh -- pnpm backend:dev
```

如果已在终端中配置了 Java 21，也可以直接运行：

```bash
./mvnw spring-boot:run
```

运行测试：

```bash
./mvnw test
```

本地默认只监听 `127.0.0.1:8080`，可通过 `SERVER_ADDRESS` 和 `SERVER_PORT` 覆盖。正式容器是否监听全部网卡由部署配置显式决定。任何账号、权限、数据库或文件存储实现都必须等对应 SPEC 确认后再加入。
