# Framework Adapter

## Upstream relationship

**Official source type:** Semi Design official semi-design-guide

The official Semi skill is the base, not inspiration. Read its `SKILL.md`, `WORKFLOWS.md`, and `BEST_PRACTICES.md` first. Keep the MCP lookup escalation intact: discover/query with `get_semi_document`; inspect component files with `get_component_file_list`; inspect source via `get_file_code`; inspect a specific implementation via `get_function_code`. Use the prototype layer only to decide screens, product composition, realistic data, and local interaction scope.

## Prototype integration rule

1. Inspect the existing project and installed package version.
2. Read the relevant official upstream file(s) before using this pack's prototype references.
3. Use official framework guidance to select and implement components.
4. Use `PROTOTYPE_PATCH.md` only for product-level decisions: one vs multiple screens, mock-data scope, interaction simulation, visual completeness, and reduced production engineering.
5. If official upstream and a custom reference disagree, upstream wins.
6. If the vendored snapshot is stale, current installed types/current official docs win.

## What this adapter deliberately does not do

- It does not rename our page recipes as official framework patterns.
- It does not claim specialist maintainer skills are full-page skills.
- It does not copy props from memory when they can be resolved from official sources.
- It does not force production architecture onto a local prototype.
