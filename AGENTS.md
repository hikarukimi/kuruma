# 仓库协作指南

## 项目结构与模块组织

本仓库是一个并列放置前端和后端项目的 workspace，不是统一的单包工程。

- `kuruma-front/web/`：React + Vite 桌面 Web 应用，源码位于 `src/`。
- `kuruma-front/mobile/`：Expo React Native 移动端应用，入口为 `App.tsx`，界面组件位于 `components/`，静态资源位于 `assets/`。
- `kuruma-back/`：Go 后端模块。后续新增 Go 包应放在该目录下。
- `docs/`：架构说明、产品能力和项目文档。

项目相关代码、测试、配置和生成文件应放在所属项目目录内，避免跨项目混放。

## 构建、测试与开发命令

请在对应项目目录下运行命令。

Web 端：

- `cd kuruma-front/web && pnpm install`：安装 Web 依赖。
- `cd kuruma-front/web && pnpm dev`：启动 Vite 开发服务器。
- `cd kuruma-front/web && pnpm build`：运行 TypeScript 检查并生成生产构建。
- `cd kuruma-front/web && pnpm lint`：运行 Web ESLint 检查。

移动端：

- `cd kuruma-front/mobile && pnpm install`：安装移动端依赖。
- `cd kuruma-front/mobile && pnpm start`：启动 Expo。
- `cd kuruma-front/mobile && pnpm android`：运行 Android 目标。
- `cd kuruma-front/mobile && pnpm ios`：运行 iOS 目标。
- `cd kuruma-front/mobile && pnpm web`：运行 Web 目标。
- `cd kuruma-front/mobile && pnpm lint`：运行 ESLint 和 Prettier 检查。

后端：

- `cd kuruma-back && go test ./...`：运行后端测试。当前仅在新增 Go 包后适用。

## 编码风格与命名规范

前端使用 TypeScript，后端使用 Go。

- 前端遵循各项目内 ESLint 和 Prettier 配置。
- Go 代码必须使用 `gofmt` 格式化。
- React 组件使用 `PascalCase`。
- 函数、变量和 Hooks 使用 `camelCase`。
- Go 包名保持简短、小写，并面向业务领域命名。
- 文件名应清晰表达职责，例如 `accident-session.ts`、`VideoPanel.tsx`、`session_service.go`。

## 测试规范

当前前端尚未配置专用测试框架。新增测试时，可以将测试放在代码旁边，或放在项目内局部 `tests/` 目录中。

建议命名：

- `VideoPanel.test.tsx`
- `session_service_test.go`

后端测试遵循 Go 标准测试约定，并使用：

- `go test ./...`

## 提交与 Pull Request 规范

本仓库当前没有可推断的历史提交规范。提交信息使用简洁的祈使句，例如：

- `Add accident session API`
- `Fix mobile video layout`

Pull Request 应包含：

- 清晰的变更摘要。
- 测试结果，或说明未运行测试的原因。
- 相关 issue 链接，如适用。
- UI 变更的截图，如适用。

## Agent 专用说明

- 保持变更聚焦，避免无关重构。
- 不要引入新的框架、包管理器或 workspace 重组，除非任务明确需要。
- 修改前先阅读相关代码和文档，遵循现有目录结构和风格。
- 不要覆盖或回退用户已有改动，除非用户明确要求。
- 文档、命令、目录结构或约定发生变化时，应同步更新本文件。
