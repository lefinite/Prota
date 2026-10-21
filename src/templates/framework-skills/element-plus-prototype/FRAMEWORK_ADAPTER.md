# Framework Adapter

## Upstream relationship

No verified official Element Plus page-generation skill is treated as upstream in this snapshot. This is therefore a custom prototype skill. Resolve component APIs from the installed Element Plus version and current official docs. Prefer the native Vue 3 component model, form/table/dialog/drawer/navigation primitives, and Element Plus design conventions; do not invent a fake “official skill” layer.

## Prototype integration rule

1. Inspect the project/package version first.
2. Resolve uncertain components/props/events/slots from installed types and official docs.
3. Use this pack's references only for page composition and prototype quality, not as API authority.
4. Keep the result locally runnable and visually faithful to the framework.
5. Allow multiple screens when the product intent needs them.

## Honesty rule

This directory is **not an official framework skill fork**. It is a custom prototype skill built from official documentation/repository knowledge.
