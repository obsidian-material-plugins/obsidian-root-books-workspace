---
name: Repository boundaries
description: Human/agent documentation, source, privacy, and release boundaries
applyTo: "**"
---

# Repository boundaries

- Obsidian to quartz workspace is an Obsidian community plugin. Source lives in `src/`.
- Keep `src/main.ts` limited to lifecycle and orchestration.
- Keep human documentation in `README.md` and `CHANGELOG.md`. Agent-only
  material belongs in `AGENTS.md` or `.github/`.
- Use npm and keep `package-lock.json` reproducible.
- Do not commit `main.js`; attach `main.js`, `manifest.json`, and `styles.css`
  to releases.
- Operate locally and offline. Do not add telemetry, remote code, dependency
  installation, or filesystem access outside the vault.
- Never install, disable, or configure companion plugins. The coordinator may enable an
  installed watched plugin only after the user clicks that target's explicit
  Enable action. Missing community plugins may open Obsidian's own install page.
- Preserve unrelated vault frontmatter and note bodies. All migrations must be
  idempotent.
- Inspect status, diff, ignored files, secrets, author identity, branch, and
  remote before every commit and push.
- The project is still in development. The approved migrations read legacy
  `book-appearance/v1` panel mappings and the former watch-profile filename;
  appearance edits write v2 blocks and watch-profile edits write the new name.
  Do not add other compatibility behavior without a concrete need.
- Use the canonical thesis template vault for local plugin development and
  direct build installation only. Treat the thesis fork as the release
  consumer: update Obsidian to quartz workspace there only through Obsidian's official
  Community plugins update action. Never copy local development artifacts into
  the fork when validating a release.
