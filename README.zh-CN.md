# AI Cloud Album｜AI 云相册

基于 Flask 和 AWS 的事件驱动图片管理系统，支持异步图片分类和 ZIP 批量处理。

[English](README.md) · [项目报告](docs/final-report.pdf) · [API 文档](docs/API_design.md) · [运行配置](docs/SETUP.md)

## 核心功能

- JWT 用户认证与密码哈希存储。
- 单张图片上传、ZIP 批量上传和异步打包下载。
- 使用 S3 存储文件，DynamoDB 管理图片元数据和任务状态。
- 使用 SQS 和 Lambda 解耦请求处理与耗时任务。
- 使用 YOLOv8 的 ONNX 模型分类图片，提取 EXIF 位置信息。
- 分类浏览、关键词搜索、Leaflet 地图展示及基于类别规则的追问。

架构图见 [英文首页](README.md#architecture)。前端向 Flask API 发起请求，后端写入 S3、DynamoDB 并发送 SQS 消息；Lambda 完成图片分类、ZIP 解压或打包，前端轮询获取处理结果。追问由规则生成，不使用大语言模型。

## 我的贡献：Huaitang Wang（王槐堂）

根据团队报告，我负责**后端开发与 AWS 集成**：

- 实现 Flask REST API，包括用户认证、图片上传和元数据管理。
- 对接 S3、SQS、DynamoDB，协调后端与 Lambda 的通信。
- 参与异步工作流设计、EC2 部署及分布式系统集成调试。

本项目为 USC EE547 团队课程项目。成员为 **Shi He、Huaitang Wang、Boxiang Zhang**。Boxiang Zhang 主要负责前端和 UI 集成，Shi He 主要负责机器学习与异步处理。本仓库是保留团队署名的个人作品展示副本。

## 目录与材料

| 路径 | 内容 |
| --- | --- |
| `backend/` | Flask API、服务层、Docker 配置和接口集成测试 |
| `frontend/` | HTML/CSS/JavaScript 页面与地图资源 |
| `lambda/` | 图片分类、ZIP 上传/下载处理及开发工具 |
| `docs/` | 最终报告、部署说明、API/数据表文档和原始训练图表 |
| `data/` | 数据准备脚本与实验用坐标数据 |

## 运行与项目边界

完整运行需要自行创建 AWS 资源并配置凭证，不是下载后即可离线运行的程序。配置见 [SETUP.md](docs/SETUP.md) 和 `.env.example`。

现有接口测试需要运行中的后端和 AWS 资源，执行时会创建测试账户并上传文件。项目尚未提供自动化基础设施部署或可复现的 Lambda 依赖构建。第三方代码、模型和数据相关内容保留原有权利，本仓库未指定统一的开源许可证。
