# Outputs 目录说明

outputs 用于保存工具运行生成的导出物、预览、构建结果或阶段性交付副本。该目录便于检查和重新生成，但不作为项目需求、技术或测试事实的正式来源。

目录约定：

- 正式业务与产品需求：docs/requirements/
- 正式参考资料：docs/requirements/references/
- 产品流程与图形化原型：docs/requirements/product-flows/
- 技术方案与设计：docs/technical/
- 开发、测试与验收资料：docs/development-testing/

如 outputs 与正式文档目录存在同名文件，评审和后续修改均以 docs 中的版本为准。

最终需要保留的交付文件可以进入版本库；LibreOffice 本地配置、逐页 QA 渲染图和其他可重复生成的检查缓存由 `.gitignore` 排除，避免仓库体积随工具运行不断增长。
