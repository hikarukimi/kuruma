# 模拟交通事故音视频通信系统技术架构方案

## 目标

构建一个用于模拟交通事故处理的音视频通信系统：司机通过手机 APP 发起视频/音频连接请求，警察通过电脑端接收多个司机连接请求，并选择其中一路进行实时通信。电脑端支持按需保存视频，整体要求音视频低延迟、不卡顿。

## 角色与端侧

- 手机端（司机）：采集摄像头、麦克风、定位；发起连接请求；等待警察接入；进行实时音视频通话。
- 电脑端（警察）：展示待接入请求列表；预览多个手机端连接状态；选择一路进入通话；控制开始/停止录像
- 服务端：负责身份认证、会话调度、信令转发、媒体服务编排、录像任务编排、录像元数据存储和状态管理。

## 技术选型

项目采用同一 workspace 下并列放置前端项目和后端项目的方式组织，不统一管理所有包。手机端和电脑端使用 TypeScript，后端服务使用 Go，以 OpenAPI、WebSocket 事件协议和共享文档作为前后端契约来源。

- 手机端：Expo Dev Client 集成 WebRTC SDK。
- 电脑端：React + Vite，用于警察工作台。
- 后端服务：Go + Gin + GORM。Gin 负责 HTTP API、中间件和 WebSocket 接入；GORM 负责 PostgreSQL 数据访问；服务内部按领域拆分 handler、service、repository、model。
- 实时音视频：WebRTC。
- 数据库：PostgreSQL。
- ORM：GORM。
- 存储：当前阶段仅存储在本地。
- 信令通道：WebSocket，Go 后端使用 Gin + WebSocket 库实现。
- API 协议：REST + OpenAPI，必要时补充 WebSocket 事件协议。

## 项目结构

```text
kuruma-front/
  mobile/       # Expo 司机端
  web/          # React 警察电脑端
  shared/       # 前端共享类型、工具和 UI 基础代码
kuruma-back/
  api/          # Go HTTP API、WebSocket 和业务服务
  internal/     # 后端内部领域模块
  migrations/   # 数据库迁移
docs/           # 技术方案与项目文档
```

## 前端技术栈

电脑端 `kuruma-front/web`：

- React + Vite + TypeScript。
- 路由：React Router。
- 状态管理：Zustand。
- 样式：Tailwind CSS。
- 音视频：WebRTC API 封装。

手机端 `kuruma-front/mobile`：

- Expo + TypeScript。
- 路由：React Navigation。
- 状态管理：Zustand。
- 音视频：`react-native-webrtc`。
- 权限能力：摄像头、麦克风、定位权限管理。
- 样式：NativeWind。

## 后端技术栈

后端 `kuruma-back`：

- Go + Gin。
- REST API：用户、事故会话、录像记录、权限管理。
- WebSocket Hub：连接请求、会话状态、警察选择接入、录像控制事件。
- GORM + PostgreSQL：保存用户、会话、事故、录像和审计日志。
- Redis：保存在线状态、排队请求、短期令牌、Pub/Sub 和分布式锁。
- 鉴权：JWT，电脑端结合角色权限控制。
- 文件存储：目前存储在本地文件系统。
- 配置：yaml文件。

## 工程质量要求

项目必须重视格式化、lint、类型检查和 LSP 报错，避免“能运行但编辑器满屏报错”的状态。

前端：

- Prettier：统一格式化 TypeScript、JSON、CSS 文件。
- ESLint：统一检查 React、React Native 和前端共享包代码。
- TypeScript：开启 `strict`，禁止隐式 `any`。
- LSP：提交前应保证 TypeScript、ESLint、Prettier 诊断无阻塞级错误。

后端：

- `gofmt` / `go fmt ./...`：统一 Go 代码格式。
- `go vet ./...`：检查常见 Go 代码问题。
- `golangci-lint run`：统一静态检查规则。
- `go test ./...`：运行后端单元测试和集成测试。
- 数据库迁移工具可使用 `golang-migrate/migrate`，迁移文件必须进入版本管理。

## 多手机连接处理

手机端发起连接后，Go 后端创建事故会话并进入等待队列。电脑端通过 WebSocket 实时收到新请求，并展示司机信息、事故编号、连接状态和时间。警察选择某一路后，后端将该会话标记为处理中，建立电脑端与对应手机端的 WebRTC 通话。

未被选择的连接保持等待、排队或超时关闭

## 后续实现优先级

1. 建立手机端到电脑端的一对一 WebRTC 通话。
2. 增加 Go WebSocket 请求队列和电脑端选择接入能力。
3. 增加录像保存、元数据管理和权限控制。
4. 增加弱网优化、监控告警和异常重连。
