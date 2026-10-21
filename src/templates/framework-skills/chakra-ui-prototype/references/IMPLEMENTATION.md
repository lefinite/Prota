# Upstream-first implementation note

Before following this prototype workflow, resolve framework API/component behavior from `../UPSTREAM.md` and any vendored official files in `../upstream/`. This reference deliberately avoids being the authority for version-specific props or installation commands.

# Implementation Workflow

## 1. Inspect before writing

If an existing project is present, inspect `package.json`, the installed UI-library version, app entry, routing, global styles, icon package, and any provider/theme configuration. Reuse them. Never scaffold a second app inside an existing prototype project.

If the folder is blank, create the smallest suitable Vite project for this framework and the target device.

## 2. Turn the request into a page brief

Internally decide the page archetype, primary user goal, dominant information object, main action, one or two secondary actions, states/overlays, and a realistic mock-data schema. Unless the user explicitly wants co-design, infer these details instead of blocking on questions.

## 3. Establish the macro layout

Create the app shell, page header/navigation, dominant content surface, and responsive behavior before micro-styling. A prototype should read correctly at a glance before details are added.

## 4. Compose with native primitives

Use the framework's own layout, forms, overlays, feedback, data-display, and navigation components whenever they cover the requirement. Custom markup is appropriate for domain-specific visuals, not as a replacement for mature native controls.

## 5. Add realistic state and interaction

Keep mock data local. Make the primary action and major filter/navigation affordance work. Simulate edit/create/delete/search/filter/submit flows locally. Do not add backend services, authentication, databases, global state libraries, or multi-route architecture unless they are essential to the requested demo.

## 6. Make a dedicated visual pass

Check hierarchy, spacing rhythm, density, alignment, typography, surface depth, color discipline, truncation, empty states, overlay sizing, and responsive overflow. Delete ornamental cards or decorative effects that do not help the user understand the product.

## 7. Verify

Run the production build. If the project already includes lint/typecheck, run them too. Fix all issues caused by the prototype. Do not introduce a new test/lint stack solely for a one-page demo.
