# Prototype Patch

This file is **not upstream framework documentation**. It is the product-prototyping extension applied after the official upstream skill/resources.

## Purpose

Optimize for a convincing prototype that a product manager, designer, stakeholder, or engineer can open locally and evaluate. The objective is **product intent fidelity + visual completion + meaningful interaction**, not production architecture.

## Precedence

1. Installed package version and typings.
2. Vendored official upstream Skill / official MCP / current official docs.
3. This prototype patch.
4. Generic frontend conventions.

The prototype patch may reduce engineering scope, but it may **never override framework API correctness**. Never invent a component, prop, event, slot, hook, CLI flag, or package name because it would make the prototype easier.

## Page-count rule

Do not force a single page.

- Use one page when one page communicates the product intent well.
- Add additional pages/states when the intent needs them: list + detail, create/edit, settings/configuration, onboarding, result view, or a substantially different task.
- Prefer 2–4 coherent pages over one overloaded page when multiple pages materially improve comprehension.
- Do not create pages merely to demonstrate components.
- When routes are unnecessary, page states may be simulated with local navigation/state. When navigation is central to the prototype, use the existing router or a minimal router.

## Prototype scope

Default to:
- local mock data;
- local component/page state;
- realistic empty/loading/success/error states only when relevant;
- working primary actions, filters, tabs, drawers/sheets/dialogs, CRUD simulation, and state transitions;
- a locally runnable frontend.

Do not add unless the request needs them:
- backend services;
- databases;
- real authentication;
- elaborate permission systems;
- production telemetry;
- deployment infrastructure;
- global state frameworks;
- enterprise-grade test pyramids;
- abstract architecture created solely for future scalability.

## Requirements inference

Do not stall on minor missing details. Infer a plausible product model from the request and make the assumptions visible in the UI through realistic copy/data. Ask only when a missing fact would fundamentally change the product direction.

## Information architecture

Before coding, identify:
1. primary user;
2. primary task;
3. critical information;
4. primary action;
5. secondary actions;
6. page/state boundaries;
7. data required to make the prototype believable.

Then choose the smallest information architecture that expresses the intent.

## Component discipline

Use the framework's native components first. A custom component is justified when it represents domain-specific product UI or a composition the framework does not provide. Do not rebuild buttons, form controls, menus, dialogs, sheets, tabs, tables, toasts, or navigation primitives with raw HTML when the framework already supplies them.

If a native component covers roughly 80% of the need, compose/customize it rather than replacing it.

## Visual quality

The page must look like a product, not a component gallery.

- Establish one clear hierarchy.
- Keep spacing rhythm consistent.
- Use typography to distinguish page title, section title, body, metadata, and labels.
- Use framework tokens/semantic colors rather than random hard-coded palettes when possible.
- Avoid gratuitous gradients, glassmorphism, giant hero typography, excessive rounded cards, and decorative charts unless the product context calls for them.
- Avoid card-everything layouts. Use whitespace, dividers, sections, lists, and tables appropriately.
- Keep status colors semantically consistent.
- Prefer realistic data and copy over `Lorem ipsum`, `Item 1`, `User A`, or meaningless random numbers.

## Interaction quality

Important-looking controls must work. At minimum:
- the primary CTA changes state or opens the intended workflow;
- main filters/tabs/search visibly affect content or active state;
- create/edit/delete actions update local mock state when shown;
- dialogs/sheets/popups open and close correctly;
- navigation between prototype pages/states is functional;
- loading/feedback is simulated only when it clarifies the flow.

## Mobile rules

For mobile libraries:
- design for touch targets and thumb reach;
- use bottom action bars, action sheets, pickers, popups, tabs, cells/lists, and full-screen drill-in patterns instead of desktop selects/tables where appropriate;
- respect safe-area padding where the framework supports it;
- avoid shrinking a desktop page into a phone viewport;
- keep one dominant action per screen when possible.

## Completion gate

Before claiming completion:
1. inspect package/library version if an existing project exists;
2. verify uncertain APIs against upstream official resources;
3. run install/build/typecheck when the environment allows it;
4. fix missing imports and console-breaking errors;
5. inspect overflow and responsive behavior;
6. check every important control for dead interactions;
7. remove TODOs, placeholder copy, accidental debug UI, and component-demo artifacts.
