# Upstream Record

**Framework:** shadcn/ui

**Snapshot date:** 2026-08-10

**Classification:** `FULL_OFFICIAL_SKILL`

**Authority used:** Official shadcn Skill

**Official upstream:** https://github.com/shadcn-ui/ui/tree/main/skills/shadcn

The upstream shadcn Skill is a consumer-facing build skill. Read it first and preserve its CLI/component/composition rules.

## What “based on official” means in this pack

- Official files placed under `upstream/` are upstream snapshots and must not be rewritten as if they were our work.
- The root `SKILL.md` is the prototype orchestration layer.
- `PROTOTYPE_PATCH.md` and `references/` are additions created for prototype generation.
- If an official skill is specialist or repository-maintainer oriented, its scope is kept explicit; the prototype wrapper does not relabel it as an official page-builder.
- When a static snapshot and the installed package/current official docs disagree, the installed/current official source wins.

## Embedded coverage

**PARTIAL** — Embedded entry + CLI/registry references; the official entry links to additional rules/customization files. Run the exact sync script for the full official directory.

## Official docs

- https://ui.shadcn.com/docs/skills
- https://ui.shadcn.com/docs

## Vendored snapshot

- `upstream/shadcn/SKILL.md`
- `upstream/shadcn/cli.md`
- `upstream/shadcn/registry.md`

See `upstream/SYNC_UPSTREAM.sh` when present for exact official source paths that can be refreshed from an internet-connected development environment.
