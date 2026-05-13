# 后端能力梳理

## 目标

后端需要支撑司机端发起事故音视频连接、警察端接入处理、WebRTC 信令交换、会话状态同步、录像保存和权限控制。当前阶段后端作为单体 Go 服务实现，内部按领域拆分服务，不需要拆成独立微服务。

## 后端服务划分

### 1. 用户与认证服务

负责司机、警察和管理员身份识别，签发和校验访问令牌，控制不同角色可访问的接口。

需要支持：

- 用户登录、退出和当前用户查询。
- 用户角色管理：司机、警察、管理员。
- JWT令牌校验。
- 接口级权限校验。

### 2. 事故会话服务

负责创建事故处理会话，并维护会话从等待、处理中到结束的完整生命周期。

需要支持：

- 司机创建事故会话。
- 查询会话详情。
- 更新会话状态。
- 记录司机、警察、事故编号、定位和创建时间。
- 处理超时、取消、结束等状态。

### 3. 请求队列与调度服务

负责管理多个司机同时等待警察接入的场景。

需要支持：

- 将新会话加入等待队列。
- 警察端查询待接入请求列表。
- 警察选择一路请求并锁定处理。
- 防止多个警察同时接入同一个会话。
- 对未处理请求执行排队、超时或取消策略。

### 4. WebSocket 实时事件服务

负责司机端和警察端的实时状态同步，以及 WebRTC 信令消息转发。

需要支持：

- 客户端建立 WebSocket 连接。
- 维护在线用户与连接映射。
- 向警察端推送新请求、状态变化和队列变化。
- 在司机端和警察端之间转发 WebRTC offer、answer、ICE candidate。
- 推送通话连接、断开、异常和录像状态事件。

### 5. 音视频信令服务

负责建立一对一 WebRTC 通话所需的业务编排。

需要支持：

- 创建通话房间或通话上下文。
- 校验会话双方身份。
- 生成本次通话的信令上下文。
- 记录通话开始、结束和异常状态。

### 6. 录像服务

负责警察端开始和停止录像，并保存录像文件与元数据。

需要支持：

- 开始录像。
- 停止录像。
- 保存录像文件到本地文件系统。
- 保存录像元数据。
- 查询录像列表和录像详情。
- 记录录像失败原因。

### 7. 配置与健康检查服务

负责后端运行配置和基础可用性检查。

需要支持：

- 从 yaml 文件加载服务配置。
- 暴露版本、运行状态和基础依赖状态。

## REST API 能力

接口路径建议统一使用 `/api/v1` 前缀。

### 认证与用户

- `POST /api/v1/auth/login`：用户登录，返回访问令牌。
- `POST /api/v1/auth/logout`：用户退出。
- `GET /api/v1/auth/me`：获取当前登录用户。
- `GET /api/v1/users`：管理员查询用户列表。
- `POST /api/v1/users`：用户注册。

### 事故会话

- `POST /api/v1/sessions`：司机创建事故会话并进入等待队列。
- `GET /api/v1/sessions/:id`：查询会话详情。
- `POST /api/v1/sessions/:id/cancel`：司机取消等待。
- `POST /api/v1/sessions/:id/accept`：警察选择并接入会话。
- `POST /api/v1/sessions/:id/end`：结束会话。

### 警察工作台

- `GET /api/v1/queue/waiting`：查询待接入请求列表。
- `GET /api/v1/queue/summary`：查询队列数量、处理中数量和超时数量。

### 录像

- `POST /api/v1/sessions/:id/recordings/start`：开始录制当前会话。
- `POST /api/v1/sessions/:id/recordings/stop`：停止录制当前会话。
- `GET /api/v1/recordings`：查询录像列表。
- `GET /api/v1/recordings/:id`：查询录像详情。
- `GET /api/v1/recordings/:id/file`：下载或访问录像文件。

## WebSocket 事件能力

WebSocket 建议使用 `/ws`，连接时携带访问令牌。事件统一包含 `type`、`requestId`、`sessionId`、`payload` 和 `timestamp`。

### 客户端发送事件

- `session.join`：加入指定会话事件通道。
- `session.leave`：离开会话事件通道。
- `webrtc.offer`：发送 WebRTC offer。
- `webrtc.answer`：发送 WebRTC answer。
- `webrtc.ice_candidate`：发送 ICE candidate。
- `call.connected`：客户端上报通话已连接。
- `call.disconnected`：客户端上报通话断开。

### 服务端推送事件

- `queue.request_created`：新司机请求进入等待队列。
- `queue.request_updated`：等待请求状态变化。
- `session.accepted`：警察已接入会话。
- `session.ended`：会话已结束。
- `session.timeout`：会话等待超时。
- `recording.started`：录像已开始。
- `recording.stopped`：录像已停止。
- `recording.failed`：录像失败。
- `webrtc.offer` / `webrtc.answer` / `webrtc.ice_candidate`：信令转发。

## 核心对象

### User

### AccidentSession

### QueueItem

### Call

### Recording

### AuditLog
