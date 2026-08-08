# Repository Guidelines

## Rule Priority & Scope

Follow the engineer's current request first, then the most specific project or directory guidance, existing code/configuration, and finally these general rules. State assumptions when a requirement is ambiguous, and choose the smallest reversible change that satisfies the task.

## Working-Tree Protection

Before editing, run `git status --short --branch` and inspect relevant diffs. Preserve existing uncommitted work; do not reset, clean, restore, or rewrite history. Only stage files belonging to the current semantic change, and never push without explicit approval.

## Project Structure & Module Organization

- `app/` contains the Vite application. React entry points are in `app/src/`, with UI code in `App.tsx` and styles in `App.css` and `index.css`.
- `app/public/` stores files served unchanged, while `app/src/assets/` stores imported images and icons.
- `app/cell-proc-anim/` is a separate Processing sketch for procedural fish, snake, and lizard animation (`.pde` files); keep its source independent from the React app.
- The root `README.md` is currently minimal. Keep app-specific setup notes in `app/README.md` unless they apply to the whole repository.

## Build, Test, and Development Commands

Run commands from `app/`:

```bash
npm ci          # Install the lockfile-pinned dependencies
npm run dev     # Start Vite with hot module replacement
npm run build   # Type-check and create the production bundle
npm run lint    # Run Oxlint
npm run preview # Serve the production bundle locally
```

There is no automated test runner configured yet. For UI changes, verify the affected flow manually in the Vite dev server and run `npm run build` before submitting. Documentation-only changes need scope and Markdown checks rather than the full application test suite.

## Coding Style & Naming Conventions

Use TypeScript and React functional components. Follow the existing two-space indentation and semicolon-free style. Name components and classes in `PascalCase`, functions and variables in `camelCase`, and CSS classes/IDs in descriptive kebab-case or the existing project style. Keep component-specific styles near their component and run `npm run lint` on changed code. Comments should explain constraints or reasoning, not restate code.

## Testing Guidelines

When adding tests, place them under `app/src/` or a clearly named `app/tests/` directory and use descriptive names such as `App.test.tsx`. Add the corresponding npm script and document it here; do not claim coverage requirements until a test framework is adopted.

## Commit & Pull Request Guidelines

Use Conventional Commits with concise Chinese descriptions, for example `feat(ui): 添加转子模拟控制` or `fix(anim): 修正链条更新`. Pull requests should explain the user-visible change, list validation commands, link a related issue when one exists, and include screenshots or a short recording for visual changes. Keep unrelated files and generated output out of commits.

## Security & Configuration Tips

Do not commit API keys, credentials, `.env` files, private paths, or generated `node_modules/` content. Keep dependencies synchronized through `app/package-lock.json`; use `npm ci` for lockfile-based setup and do not upgrade unrelated packages. The development environment is macOS, so preserve existing line endings and quote paths containing spaces.

## Agent Workflow

For changes that affect behavior, build output, dependencies, configuration, or UI, provide a reproducible validation step and report what was actually run. Use sub-agents only for independent, low-conflict work; the primary agent owns integration and final verification. Maintain `TODO.md` only for multi-step or unfinished work, and use `MEMORY.md` only for durable project decisions.
