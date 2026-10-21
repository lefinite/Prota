# Upstream Record

**Framework:** Chakra UI

**Snapshot date:** 2026-08-10

**Classification:** `FULL_OFFICIAL_BUILDER_PLUS_SPECIALISTS`

**Authority used:** Official Chakra AI Skills + MCP

**Official upstream:** https://github.com/chakra-ui/chakra-ui/tree/main/skills

Official Chakra publishes builder, migrate, and refactor skills. Builder is the primary upstream for creation; the others remain available for project-specific tasks.

## What “based on official” means in this pack

- Official files placed under `upstream/` are upstream snapshots and must not be rewritten as if they were our work.
- The root `SKILL.md` is the prototype orchestration layer.
- `PROTOTYPE_PATCH.md` and `references/` are additions created for prototype generation.
- If an official skill is specialist or repository-maintainer oriented, its scope is kept explicit; the prototype wrapper does not relabel it as an official page-builder.
- When a static snapshot and the installed package/current official docs disagree, the installed/current official source wins.

## Embedded coverage

**NONE_EMBEDDED** — Official Chakra builder/migrate/refactor directories are recorded and can be synced exactly; the wrapper is already adapted to the verified builder behavior.

## Official docs

- https://chakra-ui.com/docs/get-started/ai/skills
- https://chakra-ui.com/docs/get-started/ai/mcp-server

## Vendored snapshot

- No official file snapshot is currently embedded; use official docs/source map. This skill is explicitly custom rather than falsely labeled as an official fork.

See `upstream/SYNC_UPSTREAM.sh` when present for exact official source paths that can be refreshed from an internet-connected development environment.
