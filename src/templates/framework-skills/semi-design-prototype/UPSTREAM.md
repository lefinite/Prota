# Upstream Record

**Framework:** Semi Design

**Snapshot date:** 2026-08-10

**Classification:** `FULL_OFFICIAL_SKILL`

**Authority used:** Official Semi Design Skill + Semi MCP workflow

**Official upstream:** https://github.com/DouyinFE/semi-design/tree/main/ecosystem/semi-ui-skills

The official semi-design-guide files are the upstream base. Keep their MCP/document/source-reading workflow intact; the prototype layer changes only product scope and page-level orchestration.

## What “based on official” means in this pack

- Official files placed under `upstream/` are upstream snapshots and must not be rewritten as if they were our work.
- The root `SKILL.md` is the prototype orchestration layer.
- `PROTOTYPE_PATCH.md` and `references/` are additions created for prototype generation.
- If an official skill is specialist or repository-maintainer oriented, its scope is kept explicit; the prototype wrapper does not relabel it as an official page-builder.
- When a static snapshot and the installed package/current official docs disagree, the installed/current official source wins.

## Embedded coverage

**COMPLETE_FOR_OFFICIAL_GUIDE** — All three files in the official `ecosystem/semi-ui-skills` guide are embedded.

## Official docs

- https://semi.design/en-US/start/mcp-skills
- https://semi.design/en-US/start/getting-started

## Vendored snapshot

- `upstream/semi-design-guide/BEST_PRACTICES.md`
- `upstream/semi-design-guide/SKILL.md`
- `upstream/semi-design-guide/WORKFLOWS.md`

See `upstream/SYNC_UPSTREAM.sh` when present for exact official source paths that can be refreshed from an internet-connected development environment.
