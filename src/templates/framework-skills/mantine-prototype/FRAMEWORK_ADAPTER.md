# Framework Adapter

## Upstream relationship

**Official source type:** Mantine official specialist skills

Mantine officially publishes task-specific skills rather than one universal page-builder. Preserve those scopes: form work should defer to `mantine-form`, combobox/select/autocomplete work to `mantine-combobox`, and reusable custom-component work to `mantine-custom-components`. Whole-page information architecture, mock data, and prototype navigation are additions from this pack.

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
