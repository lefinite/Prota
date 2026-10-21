# Upstream Record

**Framework:** Mantine

**Snapshot date:** 2026-08-10

**Classification:** `OFFICIAL_SPECIALIST_SKILLS`

**Authority used:** Official Mantine specialist skills

**Official upstream:** https://github.com/mantinedev/skills

Official upstream skills are specialist skills for forms, comboboxes, and custom components; this wrapper supplies whole-page prototype orchestration without replacing them.

## What “based on official” means in this pack

- Official files placed under `upstream/` are upstream snapshots and must not be rewritten as if they were our work.
- The root `SKILL.md` is the prototype orchestration layer.
- `PROTOTYPE_PATCH.md` and `references/` are additions created for prototype generation.
- If an official skill is specialist or repository-maintainer oriented, its scope is kept explicit; the prototype wrapper does not relabel it as an official page-builder.
- When a static snapshot and the installed package/current official docs disagree, the installed/current official source wins.

## Embedded coverage

**PARTIAL** — Two official specialist entry files are embedded; their reference folders and the custom-components skill are available through the exact sync script.

## Official docs

- https://mantine.dev/guides/llms/
- https://mantine.dev/

## Vendored snapshot

- `upstream/official-skills/mantine-combobox/SKILL.md`
- `upstream/official-skills/mantine-form/SKILL.md`

See `upstream/SYNC_UPSTREAM.sh` when present for exact official source paths that can be refreshed from an internet-connected development environment.
