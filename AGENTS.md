# Repository Guidelines

## Project Structure & Module Organization
The React front end lives in `src/`, with route-level views under `src/pages`, global state in `src/redux`, reusable hooks in `src/hooks`, and UI elements inside `src/componets`. Shared utilities sit in `src/utils`, while static assets load from `public/` and `src/assets/`. Native functionality is handled in `src-tauri/`, where `src-tauri/src/` contains the Rust commands exposed to the UI, `tauri.conf.json` holds build metadata, and `icons/` plus `capabilities/` store platform packaging assets.

## Build, Test, and Development Commands
Use `npm install` to sync dependencies. `npm run dev` starts Vite for rapid front-end iteration, and `npm run tauri dev` launches the combined Tauri shell (Rust backend + Vite frontend) for true desktop parity. `npm run build` performs a type check (`tsc`) and emits a production bundle in `dist/`. Ship installers with `npm run tauri build`, which compiles the Rust binary and packages the desktop app for the current platform.

## Coding Style & Naming Conventions
TypeScript + React is the default; favor functional components and hooks. Follow the configured ESLint rules (`@typescript-eslint`, `react`, `import`). Use two-space indentation, keep files typed (`.ts/.tsx`), and reserve PascalCase for components/hooks/models (`NoteCard.tsx`) while Redux slices stay camelCase (`notesSlice.ts`). Tailwind utility classes can live in `App.css` or inline className strings. Rust modules in `src-tauri` follow snake_case naming and clippy-safe patterns.

## Testing Guidelines
Add Vitest + React Testing Library specs under `src/__tests__` or next to the component as `<Component>.test.tsx`. Name files after the behavior (`editor-toolbar.test.tsx`) and focus assertions on observable outcomes. Smoke tests for Tauri commands live in `src-tauri/tests/` via `cargo test`. Cover reducers, filesystem integrations, and any user-critical flows (import/export, editor persistence) before requesting review.

## Commit & Pull Request Guidelines
Commits should stay short, imperative, and scoped (see `added download progress bar`, `update eslint`). Reference tickets in the subject when applicable (`add offline cache #123`). For pull requests, describe motivation, summarize changes, list verification steps (commands run), and attach screenshots/gifs for UI updates. Link to relevant issues and call out follow-up work so reviewers can reason about scope quickly.

## Security & Configuration Tips
Never commit secrets; desktop credentials belong in `.env` files referenced via `tauri.conf.json`. When adding Tauri commands, validate inputs in Rust and gate filesystem access through the capability JSON manifests. Recheck platform entitlements before distributing signed builds.
