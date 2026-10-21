# Upstream Record

**Framework:** TDesign React

**Snapshot date:** 2026-08-10

**Classification:** `OFFICIAL_REPO_DEVELOPMENT_SKILLS`

**Authority used:** Official tdesign-react AGENTS/specs/repository-development skills

**Official upstream:** https://github.com/Tencent/tdesign-react

The official repo skills primarily govern development of the TDesign library itself. They are useful upstream engineering knowledge, but this consumer page-generation wrapper is custom and must not pretend those are page-builder skills.

## What “based on official” means in this pack

- Official files placed under `upstream/` are upstream snapshots and must not be rewritten as if they were our work.
- The root `SKILL.md` is the prototype orchestration layer.
- `PROTOTYPE_PATCH.md` and `references/` are additions created for prototype generation.
- If an official skill is specialist or repository-maintainer oriented, its scope is kept explicit; the prototype wrapper does not relabel it as an official page-builder.
- When a static snapshot and the installed package/current official docs disagree, the installed/current official source wins.

## Embedded coverage

**NONE_EMBEDDED** — Official `AGENTS.md`, `.codebuddy/skills`, `.codebuddy/specs`, and chat-engine agent guide are source-mapped and syncable.

## Official docs

- https://tdesign.tencent.com/react/getting-started
- https://github.com/Tencent/tdesign-react/blob/develop/AGENTS.md

## Vendored snapshot

- No official file snapshot is currently embedded; use official docs/source map. This skill is explicitly custom rather than falsely labeled as an official fork.

See `upstream/SYNC_UPSTREAM.sh` when present for exact official source paths that can be refreshed from an internet-connected development environment.
