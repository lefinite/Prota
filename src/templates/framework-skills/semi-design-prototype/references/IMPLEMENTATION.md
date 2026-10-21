# Upstream-first implementation note

Before following this prototype workflow, resolve framework API/component behavior from `../UPSTREAM.md` and any vendored official files in `../upstream/`. This reference deliberately avoids being the authority for version-specific props or installation commands.

# Implementation Workflow

## 1. Inspect before writing

If an existing project is present, inspect `package.json`, current UI library/version, entry file, routing, global CSS, and existing theme/provider. Reuse them. Do not scaffold a second app inside an existing app.

If the folder is blank, create the smallest suitable Vite-based project for the framework in this skill.

## 2. Convert the request into a page brief

Internally decide:
- page archetype;
- primary user goal;
- dominant information object;
- primary action;
- 1–2 secondary actions;
- required states/overlays;
- realistic mock data schema.

Do not ask for these unless the user explicitly wants collaborative design. Infer them and proceed.

## 3. Build macro layout first

Create app shell, page header, major surfaces, and responsive structure before filling in details. A page with good macro hierarchy and mediocre micro-styling is easier to fix than a pile of beautifully styled components with no composition.

## 4. Use library-native primitives

Before creating a custom control, check `COMPONENTS.md` and the official docs. Custom HTML/CSS is acceptable for domain visuals (illustrations, bespoke metric visualization, media preview) but not as a replacement for a mature library primitive.

## 5. Add realistic data and interaction

Use local constants and component state. Keep a small mock data model near the page. Simulate async actions with a short loading state only if the environment/request benefits from it; do not add backend scaffolding.

## 6. Visual pass

Check hierarchy, alignment, card density, table/list scanability, color use, empty space, truncation, and overlay sizing. Remove decorative clutter that does not serve the product.

## 7. Verification

Run the project's build command. If available, also run lint/typecheck, but do not spend prototype time introducing a new lint/test stack. Fix all build/type errors caused by the prototype.
