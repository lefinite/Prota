# Upstream Record

**Framework:** Material UI (MUI)

**Snapshot date:** 2026-08-10

**Classification:** `OFFICIAL_SPECIALIST_AGENT_GUIDES`

**Authority used:** Official MUI AGENTS.md + specialist integration agent guides + MCP

**Official upstream:** https://github.com/mui/material-ui

MUI officially publishes repository AGENTS.md plus specialist agent guides for styling, theming, Next.js, and Tailwind, and an MCP server. These are upstream authorities for those topics; the whole-page prototype orchestration remains our extension rather than an official MUI page-builder fork.

## What “based on official” means in this pack

- Official files placed under `upstream/` are upstream snapshots and must not be rewritten as if they were our work.
- The root `SKILL.md` is the prototype orchestration layer.
- `PROTOTYPE_PATCH.md` and `references/` are additions created for prototype generation.
- If an official skill is specialist or repository-maintainer oriented, its scope is kept explicit; the prototype wrapper does not relabel it as an official page-builder.
- When a static snapshot and the installed package/current official docs disagree, the installed/current official source wins.

## Embedded coverage

**NONE_EMBEDDED** — Official root `AGENTS.md` and specialist `skills/` agent guides are source-mapped and syncable.

## Official docs

- https://mui.com/material-ui/getting-started/mcp/
- https://mui.com/material-ui/getting-started/installation/
- https://mui.com/material-ui/getting-started/templates/

## Vendored snapshot

- No official file snapshot is currently embedded; use official docs/source map. This skill is explicitly custom rather than falsely labeled as an official fork.

See `upstream/SYNC_UPSTREAM.sh` when present for exact official source paths that can be refreshed from an internet-connected development environment.
