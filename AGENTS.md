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

## 编码风格与命名规范

前端使用 TypeScript，后端使用 Go。

- Go 代码必须使用 `gofmt` 格式化。
- Go 包名保持简短、小写，并面向业务领域命名。
- 前端遵循各项目内 ESLint 和 Prettier 配置。
- 函数、变量和 Hooks 使用 `camelCase`。
- React 组件使用 `PascalCase`。
- 前端错误信息提示应该使用全局消息提示组件，而不是在每个组件都维护一个错误展示逻辑。
- 一个函数如果他的运算逻辑不算复杂，就不使用useMemo等优化。
- 文件名应清晰表达职责，例如 `accident-session.ts`、`VideoPanel.tsx`、`session_service.go`。

## 测试规范

当前项目不需要做测试。

## Agent 专用说明

- 保持变更聚焦，避免无关重构。
- 不要引入新的框架、包管理器或 workspace 重组，除非任务明确需要。
- 修改前先阅读相关代码和文档，遵循现有目录结构和风格。
- 不要覆盖或回退用户已有改动，除非用户明确要求。
- 文档、命令、目录结构或约定发生变化时，应同步更新本文件。
