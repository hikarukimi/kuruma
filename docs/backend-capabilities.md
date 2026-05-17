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

以下对象可作为 PostgreSQL 表结构和 GORM model 的初始设计。所有主表建议统一包含 `id`、`created_at`、`updated_at`，需要软删除的管理类数据可额外包含 `deleted_at`。

### User

用户表，保存司机、警察和管理员账号。

建议字段：

- `id`：主键，建议使用 UUID。
- `username`：登录名，唯一。
- `password`：密码哈希。
- `display_name`：展示名称。
- `phone`：手机号，可选，建议唯一索引但允许为空。
- `role`：用户角色，枚举值为 `driver`、`police`、`admin`。
- `status`：账号状态，枚举值为 `active`、`disabled`。
- `last_login_at`：最近登录时间。
- `created_at`：创建时间。
- `updated_at`：更新时间。
- `deleted_at`：软删除时间，可选。

关系：

- 一个司机用户可以创建多个 `AccidentSession`，对应 `accident_sessions.driver_id`。
- 一个警察用户可以处理多个 `AccidentSession`，对应 `accident_sessions.police_id`。
- 一个用户可以触发多条 `AuditLog`，对应 `audit_logs.actor_user_id`。

### AccidentSession

事故会话表，保存一次司机事故请求从等待到处理结束的生命周期。

建议字段：

- `id`：主键，建议使用 UUID。
- `accident_no`：事故编号，唯一，用于前端展示和人工检索。
- `driver_id`：司机用户 ID，关联 `users.id`。
- `police_id`：接入警察用户 ID，关联 `users.id`，等待阶段可为空。
- `status`：会话状态，枚举值为 `waiting`、`locked`、`in_call`、`ended`、`cancelled`、`timeout`、`failed`。
- `driver_latitude`：司机上报纬度。
- `driver_longitude`：司机上报经度。
- `location_text`：定位文本或逆地理编码结果，可选。
- `description`：司机填写的事故描述，可选。
- `priority`：队列优先级，默认 `normal`，可扩展 `low`、`high`。
- `accepted_at`：警察接入时间。
- `started_at`：通话开始时间。
- `ended_at`：会话结束时间。
- `end_reason`：结束原因，例如司机取消、警察结束、超时、异常断开。
- `created_at`：创建时间。
- `updated_at`：更新时间。

关系：

- 多个事故会话属于同一个司机用户，`driver_id` 关联 `users.id`。
- 多个事故会话可由同一个警察用户处理，`police_id` 关联 `users.id`。
- 一个事故会话最多对应一个当前等待队列项 `QueueItem`，历史队列变化可通过审计日志记录。
- 一个事故会话可以包含多条 `Call`，用于支持异常重连或后续多次通话尝试。
- 一个事故会话可以包含多条 `Recording`。
- 一个事故会话可以产生多条 `AuditLog`。

索引建议：

- `accident_no` 唯一索引。
- `driver_id`、`police_id` 普通索引。
- `status`、`created_at` 组合索引，用于队列和列表查询。

### QueueItem

等待队列表，保存警察工作台待接入请求及锁定状态。当前阶段也可以只保存活跃队列项，历史变化写入 `AuditLog`。

建议字段：

- `id`：主键，建议使用 UUID。
- `session_id`：事故会话 ID，外键关联 `accident_sessions.id`，建议唯一。
- `driver_id`：司机用户 ID，冗余字段，外键关联 `users.id`，便于队列查询。
- `locked_by`：锁定该请求的警察用户 ID，外键关联 `users.id`，未锁定时为空。
- `status`：队列状态，枚举值为 `waiting`、`locked`、`removed`、`timeout`、`cancelled`。
- `priority`：队列优先级。
- `position`：队列位置，可选；也可由 `priority` 和 `created_at` 动态计算。
- `locked_at`：锁定时间。
- `expires_at`：等待超时时间。
- `created_at`：入队时间。
- `updated_at`：更新时间。

关系：

- 一个队列项必须属于一个 `AccidentSession`。
- 一个队列项必须属于一个司机 `User`。
- 一个队列项可被一个警察 `User` 锁定。
- 当队列项状态从 `waiting` 变为 `locked` 时，应同步更新 `AccidentSession.status` 和 `AccidentSession.police_id`。

索引建议：

- `session_id` 唯一索引，避免同一会话重复入队。
- `status`、`priority`、`created_at` 组合索引，用于警察端待处理列表。
- `locked_by` 普通索引，用于查询警察当前锁定的请求。

### Call

通话表，保存一次 WebRTC 通话尝试或实际通话记录。

建议字段：

- `id`：主键，建议使用 UUID。
- `session_id`：事故会话 ID，外键关联 `accident_sessions.id`。
- `driver_id`：司机用户 ID，外键关联 `users.id`。
- `police_id`：警察用户 ID，外键关联 `users.id`。
- `room_id`：信令房间或通话上下文 ID，唯一。
- `status`：通话状态，枚举值为 `created`、`signaling`、`connected`、`disconnected`、`ended`、`failed`。
- `started_at`：通话建立时间。
- `connected_at`：媒体连接成功时间。
- `ended_at`：通话结束时间。
- `disconnect_reason`：断开原因，可选。
- `failure_reason`：失败原因，可选。
- `created_at`：创建时间。
- `updated_at`：更新时间。

关系：

- 一个通话必须属于一个 `AccidentSession`。
- 一个通话分别关联司机 `User` 和警察 `User`。
- 一个通话可以产生多条 `Recording`，例如分段录像或重试录像。
- 一个通话可以产生多条 `AuditLog`，例如信令异常、连接成功和断开事件。

索引建议：

- `session_id`、`created_at` 组合索引，用于查询会话通话历史。
- `room_id` 唯一索引，用于信令上下文定位。
- `status` 普通索引，用于异常通话扫描。

### Recording

录像表，保存警察端对通话录像产生的文件元数据。

建议字段：

- `id`：主键，建议使用 UUID。
- `session_id`：事故会话 ID，外键关联 `accident_sessions.id`。
- `call_id`：通话 ID，外键关联 `calls.id`，可选但建议保存。
- `started_by`：开始录像的警察用户 ID，外键关联 `users.id`。
- `status`：录像状态，枚举值为 `recording`、`completed`、`failed`、`deleted`。
- `file_path`：本地录像文件路径。
- `file_name`：录像文件名。
- `mime_type`：文件类型，例如 `video/webm` 或 `video/mp4`。
- `file_size_bytes`：文件大小。
- `duration_seconds`：录像时长。
- `started_at`：录像开始时间。
- `ended_at`：录像结束时间。
- `failure_reason`：录像失败原因。
- `checksum`：文件校验值，可选。
- `created_at`：创建时间。
- `updated_at`：更新时间。

关系：

- 一个录像必须属于一个 `AccidentSession`。
- 一个录像可属于一个具体 `Call`。
- 一个录像由一个警察 `User` 发起。
- 录像开始、停止、失败和删除应写入 `AuditLog`。

索引建议：

- `session_id`、`created_at` 组合索引，用于查询会话录像列表。
- `call_id` 普通索引。
- `started_by`、`created_at` 组合索引，用于警察个人录像查询。
- `status` 普通索引，用于失败录像排查。

### AuditLog

审计日志表，记录关键业务操作和状态变化，便于追踪事故处理过程。

建议字段：

- `id`：主键，建议使用 UUID。
- `actor_user_id`：操作人用户 ID，外键关联 `users.id`，系统自动任务可为空。
- `actor_role`：操作人角色快照，便于后续审计。
- `action`：操作类型，例如 `session.created`、`session.accepted`、`call.connected`、`recording.started`。
- `target_type`：目标对象类型，例如 `user`、`session`、`queue_item`、`call`、`recording`。
- `target_id`：目标对象 ID。
- `session_id`：事故会话 ID，外键关联 `accident_sessions.id`，非会话类操作可为空。
- `call_id`：通话 ID，外键关联 `calls.id`，可选。
- `recording_id`：录像 ID，外键关联 `recordings.id`，可选。
- `before_state`：变更前状态快照，JSON。
- `after_state`：变更后状态快照，JSON。
- `ip_address`：客户端 IP。
- `user_agent`：客户端 User-Agent。
- `created_at`：创建时间。

关系：

- 一条审计日志可关联一个操作人 `User`。
- 一条审计日志可关联一个 `AccidentSession`、`Call` 或 `Recording`。
- `target_type` 和 `target_id` 用于表达通用目标关系，外键字段用于高频查询和强约束。

索引建议：

- `session_id`、`created_at` 组合索引，用于事故处理全过程回放。
- `actor_user_id`、`created_at` 组合索引，用于用户操作追踪。
- `target_type`、`target_id` 组合索引，用于对象审计查询。
- `action`、`created_at` 组合索引，用于排查特定事件。
