# Repository Guidelines

## Project Structure & Module Organization
- `backend/` — Go code (Wails bindings, filesystem, platform shims). Platform files use suffixes like `_windows.go`, `_unix.go`.
- `frontend/` — Preact + Tailwind app (`src/`, `public/`, `vite.config.js`).
- `main.go` — Wails bootstrap; `wails.json` wires Bun/Vite to Wails.
- `build/` — Output artifacts after `wails build`.
- `.env` — Optional local configuration (not required for dev).

## Build, Test, and Development Commands
- Install deps: `bun install` (root triggers frontend install via Wails) or run inside `frontend/`.
- Dev (hot reload): `wails dev` (spawns Vite + Wails).
- Frontend only dev: `cd frontend && bun run dev`.
- Production build (Windows): `wails build -clean` → `build/bin/lightning_explorer.exe`.
- Backend tests (if present): `go test ./backend/...` or `go test ./...`.

## Coding Style & Naming Conventions
- Go: run `gofmt`/`go fmt ./...` and `go vet ./...`. Use PascalCase for exported symbols; keep packages lower-case. Match existing file names (e.g., `app_files.go`), and platform suffixes (`*_windows.go`, `*_unix.go`).
- Frontend: Preact + Vite, JavaScript/JSX. Keep components in `frontend/src/components/`, hooks in `src/hooks/`, utilities in `src/utils/`. Tailwind utility-first classes; avoid custom global CSS where possible.
- General: Prefer small, focused modules and pure helpers in `utils`.

## Testing Guidelines
- Backend: Table-driven tests in `_test.go`. Aim for coverage on critical filesystem helpers and serialization.
- Frontend: No test runner configured. If adding tests, prefer Vitest and colocate under `src/` with `.test.jsx` files.

## Commit & Pull Request Guidelines
- Use Conventional Commits (observed): `feat:`, `fix:`, `refactor(backend):`, `chore:`. Scope with `(frontend)`/`(backend)` when useful.
- PRs: include a clear description, linked issues, and screenshots/gifs for UI changes. Keep PRs small and atomic. Ensure `wails dev` runs and `wails build -clean` succeeds locally.

## Security & Configuration Tips
- Windows-first: verify platform-specific changes compile for Windows (`*_windows.go`). Avoid privileged operations in dev code paths. Treat delete operations conservatively.

## Agent-Specific Notes
- This file applies to the repo root. Follow naming patterns and platform suffix conventions when creating new files. Keep edits minimal and aligned with existing structure.
