# Repository Guidelines

## Project Structure & Module Organization

This repository is a workspace that keeps frontend and backend projects side by side; it is not one unified package tree.

- `kuruma-front/web/`: React + Vite desktop web app. Source code lives in `src/`.
- `kuruma-front/mobile/`: Expo React Native mobile app. Entry point is `App.tsx`; UI lives in `components/`; static assets live in `assets/`.
- `kuruma-back/`: Go backend module. Add Go packages under this directory as the backend grows.
- `docs/`: architecture notes and project documentation.

Keep project-specific code, tests, configuration, and generated files inside the owning project directory.

## Build, Test, and Development Commands

Run commands from the relevant project directory:

- `cd kuruma-front/web && pnpm install`: install web dependencies.
- `cd kuruma-front/web && pnpm dev`: start the Vite development server.
- `cd kuruma-front/web && pnpm build`: run TypeScript checks and create a production build.
- `cd kuruma-front/web && pnpm lint`: run ESLint for the web app.
- `cd kuruma-front/mobile && pnpm install`: install mobile dependencies.
- `cd kuruma-front/mobile && pnpm start`: start Expo.
- `cd kuruma-front/mobile && pnpm android` / `pnpm ios` / `pnpm web`: run Expo for a target.
- `cd kuruma-front/mobile && pnpm lint`: run ESLint and Prettier checks.
- `cd kuruma-back && go test ./...`: run backend tests once Go packages are added.

## Coding Style & Naming Conventions

Use TypeScript for frontend code and Go for backend code. Follow ESLint and Prettier in each frontend project. Use `gofmt` for Go files.

Prefer descriptive names such as `accident-session.ts`, `VideoPanel.tsx`, or `session_service.go`. React components use `PascalCase`; functions, variables, and hooks use `camelCase`; Go packages are short, lowercase, and domain-oriented.

## Testing Guidelines

No dedicated frontend test framework is configured yet. When adding tests, place them near the code or in a local `tests/` directory, using names like `VideoPanel.test.tsx` or `session_service_test.go`.

Backend tests should use Go’s standard testing conventions and run with `go test ./...`.

## Commit & Pull Request Guidelines

This repository has no commit history, so no established convention can be inferred. Use concise imperative messages, for example `Add accident session API` or `Fix mobile video layout`.

Pull requests should include a clear summary, test results or a reason tests were not run, linked issues when applicable, and screenshots for UI changes.

## Agent-Specific Instructions

Keep changes focused. Do not introduce new frameworks, package managers, or workspace restructuring unless required. Update this guide when commands, layout, or conventions change.
