# Upstream Record

**Framework:** Arco Design

**Snapshot date:** 2026-08-10

**Classification:** `FULL_OFFICIAL_SKILL`

**Authority used:** Official Arco Design Skill

**Official upstream:** https://github.com/arco-design/arco-design-skill

The official Arco skill is a broad component knowledge skill. Use it as the component/API authority; this wrapper adds page planning and prototype constraints.

## What “based on official” means in this pack

- Official files placed under `upstream/` are upstream snapshots and must not be rewritten as if they were our work.
- The root `SKILL.md` is the prototype orchestration layer.
- `PROTOTYPE_PATCH.md` and `references/` are additions created for prototype generation.
- If an official skill is specialist or repository-maintainer oriented, its scope is kept explicit; the prototype wrapper does not relabel it as an official page-builder.
- When a static snapshot and the installed package/current official docs disagree, the installed/current official source wins.

## Embedded coverage

**PARTIAL** — The official entry file is embedded; its 82 linked reference documents are intentionally not mislabeled as embedded. Run the exact sync script for the complete official skill tree.

## Official docs

- https://arco.design/react/docs/start
- https://arco.design/

## Vendored snapshot

- `upstream/arco-design/SKILL.md`

See `upstream/SYNC_UPSTREAM.sh` when present for exact official source paths that can be refreshed from an internet-connected development environment.
