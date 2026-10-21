---
name: arco-design-prototype
description: "Build polished, locally runnable Web / desktop product prototypes with Arco Design. Use when the user asks to create, redesign, prototype, mock, implement, or demo a UI using Arco Design. This skill is upstream-first: framework correctness comes from official Skill/MCP/docs, then the prototype patch adds page planning, realistic mock data, working interactions, and prototype-scope constraints."
---

# Arco Design Prototype

This is a **prototype orchestration wrapper**, not a replacement for framework documentation.

**Technology:** React  
**Primary surface:** Web / desktop  
**Best visual fit:** modern enterprise/admin/content tooling with Arco visual language  
**Upstream class:** `FULL_OFFICIAL_SKILL`

## Mandatory read order

1. Read `UPSTREAM.md` to understand what official resources actually exist and what their scope is.
2. Read `FRAMEWORK_ADAPTER.md` for the exact relationship between that upstream and prototype generation.
3. If `upstream/` contains official Skill files relevant to the request, read those **before implementing**. Follow their API, CLI, component, composition, migration, and MCP rules.
4. Read `PROTOTYPE_PATCH.md` for the changes in objective: high-fidelity local prototype rather than production engineering.
5. Read `references/COMPONENTS.md` and `references/VISUAL_LANGUAGE.md` for page assembly guidance. They are prototype references, not API authority.
6. Use `references/PAGE_RECIPES.md` and `references/PAGE_PLANNING.md` when deciding whether the request needs one or multiple pages.
7. Before finishing, run `references/QUALITY_GATE.md` and the completion gate in `PROTOTYPE_PATCH.md`.

## Authority rule

Use this order when instructions conflict:

**installed package/types > current official Skill/MCP/docs > vendored upstream snapshot > prototype patch > prototype reference notes**.

The prototype layer may say “keep it simple,” but it may never justify an invented API. If an API is uncertain, verify rather than guessing.

## Goal

Turn a product request into the smallest coherent set of screens/states that makes the product idea easy to evaluate. The result should be visually convincing, locally runnable, and interactive enough that the main flow can be experienced.

Do **not** default to production architecture. Backend, auth, persistence, global state, permissions, analytics, deployment, and extensive testing are optional scope, not prerequisites for a prototype.

## Page-count behavior

- Simple intent: one page is usually best.
- List/detail, CRUD, configuration, onboarding, or distinct workflow stages: create additional pages/states when they clarify the product.
- Multiple pages are explicitly allowed; never force the request into a single screen.
- Do not manufacture extra pages merely to showcase the framework.

## Execution workflow

### 1. Inspect existing project

If code already exists, inspect package versions, entry points, styling/theme/provider setup, routing, and existing conventions. Reuse the project instead of scaffolding another application inside it.

### 2. Resolve framework knowledge first

Use the official upstream resources described in `UPSTREAM.md`. If the framework publishes an MCP and it is available, use it for version-sensitive APIs. If the official skill directs a particular lookup workflow, keep that workflow.

### 3. Plan product structure

Determine primary user/task, data model, page set, main action, and meaningful secondary states. Keep the architecture as small as the product intent allows.

### 4. Compose with native components

Use the framework for shell/navigation, forms, data display, overlays, feedback, loading, and status UI. Build custom markup mainly for domain-specific visuals.

### 5. Add believable data and interactions

Use coherent mock data. Make filters, tabs, search, drawers/sheets/dialogs, navigation, and primary CRUD/task actions work with local state.

### 6. Polish in the framework's visual language

Follow `references/VISUAL_LANGUAGE.md`; prefer tokens/theming primitives over arbitrary CSS. The prototype should look like Arco Design, not a generic dashboard with one library Button.

### 7. Verify

Build/typecheck where possible. Fix imports, runtime-breaking errors, overflow, dead controls, and obvious responsive issues. Remove TODOs and placeholder/demo content.

## Framework-specific upstream note

The official Arco skill is a broad component knowledge skill. Use it as the component/API authority; this wrapper adds page planning and prototype constraints.

## Prototype reference map

- `UPSTREAM.md` — provenance and upstream classification
- `FRAMEWORK_ADAPTER.md` — framework-specific upstream → prototype integration rules
- `PROTOTYPE_PATCH.md` — exactly what this pack adds/changes
- `references/PAGE_PLANNING.md` — deciding one vs multiple pages
- `references/IMPLEMENTATION.md` — implementation checklist
- `references/COMPONENTS.md` — role-oriented component map (non-authoritative for exact APIs)
- `references/PAGE_RECIPES.md` — common page compositions
- `references/VISUAL_LANGUAGE.md` — visual direction
- `references/QUALITY_GATE.md` — acceptance checklist
- `evals/EVALS.md` — behavioral tests
