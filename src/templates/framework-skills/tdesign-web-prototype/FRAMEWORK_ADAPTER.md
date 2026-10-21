# Framework Adapter

## Upstream relationship

**Official source type:** TDesign React repository AI guidance

The official TDesign React AI material is primarily repository-maintainer guidance. It documents the base React line and the AIGC/chat line, repository architecture, specs, and skills for creating/styling/testing/releasing components. Do not misrepresent those maintainer skills as an official consumer page-builder. Use them for TDesign conventions and AIGC-specific context, then use current public component docs for application-page APIs.

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
