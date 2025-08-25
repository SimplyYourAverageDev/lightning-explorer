# Repository Guidelines

## Project Structure & Module Organization
- backend/: Go + Wails backend (filesystem, platform, events, app_* modules). Example: `backend/filesystem.go`, `backend/platform_windows.go`.
- frontend/: Preact + Tailwind app. Key folders: `src/components/`, `src/hooks/`, `src/utils/`, `src/styles/`. Entry points: `src/main.jsx`, `src/app.jsx`.
- main.go: Wails bootstrap; embeds `frontend/dist/`.
- build/: Compiled artifacts (e.g., Windows exe under `build/bin/`).
- wails.json: Wails config and Bun scripts.

## Build, Test, and Development Commands
- `wails dev`: Run the full app with hot reload (frontend + Go).
- `wails build -clean`: Production build (outputs `build/bin/lightning_explorer.exe`).
- `bun install`: Install frontend deps (Wails runs this automatically on build/dev).
- `bun run build:optimized`: Optimized frontend bundle (used by Wails build).
- `go fmt ./... && go vet ./...`: Format and basic static checks for Go code.

## Coding Style & Naming Conventions
- Go: Use `gofmt` (tabs), idiomatic names (exported identifiers in PascalCase), small cohesive files (see existing `app_*` and `fileops_*` patterns).
- JS/JSX: 4‑space indent, semicolons, double quotes. Components in PascalCase (e.g., `StreamingVirtualizedFileList.jsx`); hooks start with `use*` in `src/hooks/`; utilities camelCase in `src/utils/`.
- CSS: Prefer Tailwind utilities; keep Neo‑Brutalist look (1px borders, no shadows/gradients).

## Testing Guidelines
- No formal suite yet. For backend helpers, add Go unit tests (`*_test.go`) and run `go test ./...`.
- For UI changes, provide a manual test plan and verify via `wails dev` (navigation, selection, context menus, DnD, clipboard, drives).

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `chore:`, optional scopes (e.g., `feat(fs): …`).
- PRs must include: clear description, linked issues, screenshots/GIFs for UI, manual test steps, and impact notes.
- Before submitting: `go fmt ./...`, `go vet ./...`, `bun run build:optimized`, `wails build -clean` (ensure no errors).

## Security & Configuration Tips
- Do not commit secrets. Treat `.env` as local‑only; if needed, add sample keys in an `.env.example` and ignore `.env`.
- Windows is the primary target; macOS/Linux builds are best‑effort and may lack platform features.
