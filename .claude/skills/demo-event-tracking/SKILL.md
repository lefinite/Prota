---
name: demo-event-tracking
description: Analyze an active Prota demo or infinite-canvas board, select only decision-useful analytics events, and generate a version-scoped tracking manifest with stable DOM bindings for a Prota tracking review tab. Use for "生成埋点", "埋点方案", "埋点可视化", "event tracking for this demo", or /demo-event-tracking. This is for prototype specifications, not production analytics SDK instrumentation.
---

# Demo Event Tracking

Generate a small, actionable analytics specification for the **current Demo version**. Do not add real telemetry, an analytics SDK, network calls, listeners, or tracking code. Reviewability and low development cost matter more than event count.

## 1. Locate and inspect

1. Resolve active `projectId`, `pageId`, `version` from Prota's run context; use the workspace's `data/projects.json` only as fallback. Never assume project `readify` or silently choose a historical version.
2. Inspect `src/pages/{projectId}/{pageId}/{version}/index.html`, `styles.css`, `app.js`, and imported components. For `pageMode: infinite-canvas`, inspect `canvas-data.js` and relevant `boards/{boardId}/index.html`, CSS, JS. Do **not** track editor toolbar, pan/zoom, annotation controls, or agent shell.
3. Read relevant PRD, user journeys, success/failure states, existing `tracking/events.json`. Compare other pages/versions read-only to reuse event names.
4. If the version/source cannot be identified, stop and report what is missing. Never write product templates or prior versions.

## 2. Select valuable events

For each candidate, identify the **product question**, the **decision someone can make**, and the precise signal/handler. Score:

| Factor | Points |
| --- | --- |
| Business impact / user outcome | 0–3 |
| Actionability / decision utility | 0–3 |
| Measurement gap in funnel | 0–2 |
| Implementation/maintenance cost | subtract 0–2 |
| Duplication / derivable signal | subtract 0–2 |

Keep only scores **≥5** with a concrete question and decision. **≥7 is P0**, **5–6 P1**. Aim for **3–8 events**, **hard maximum 12 per page version**. If >8, consolidate variants using restrained enum parameters or explicitly justify each extra event. Zero is valid for a screen with no significant action.

Prefer key funnel entry, primary user actions, meaningful outcomes, and diagnostic failures. Exclude cosmetic toggles, hover, minor scrolling, focus/typing, every small button, redundant clicks/results, and sensitive user input. One semantic event can have multiple targets, not one event per button.

Do not equate a button click with success. An outcome with no visible target is a **logical event** with `targets: []`, shown in the list without a fake badge.

## 3. Write the manifest

Read [references/contract.md](references/contract.md) entirely before writing.

1. Write only `src/pages/{projectId}/{pageId}/{version}/tracking/events.json`. It belongs to that business version, never to the shared editor runtime or project defaults.
2. Use stable `snake_case` names and IDs. Include Chinese title, purpose, product question, decision, score, priority, signal, precise trigger, ≤5 safe parameter definitions, and targets.
3. On bindable controls, add a unique invisible `data-prota-track-id` attribute **only when safe**, to their source HTML/JSX/template. It is an inspection anchor, **not an event handler**. If fragile/dynamic, use a unique CSS selector fallback and lower confidence. Verify runtime uniqueness when possible.
4. For infinite canvas, each target must identify its `boardId`, `nodeId` when resolvable, and `path` under the current version. Never attach bindings to the outer editor.
5. Regenerate idempotently: retain the same semantic IDs, preserve reviewed names, and mark vanished/ambiguous anchors `needs_review`. Never silently map one event to an unrelated element.
6. Keep excluded candidates in `omitted` with a short reason. They are not live events.
7. Preserve unrelated code, assets, handlers, pending changes, and all historical versions.

## 4. Validate and hand off

1. Run `node .claude/skills/demo-event-tracking/scripts/validate.mjs <path-to-events.json>` from the Prota root (or the validator bundled beside this Skill). Fix all failures.
2. When browser access exists, verify that each bound anchor resolves exactly once in its **own** iframe and correct version. Do not claim browser validation if unavailable.
3. Report retained events (priority, decision, trigger, target), omitted candidates, unresolved bindings, changed files, and visualization limitations.
4. Do not claim analytics were actually sent; do not create a backend, change sharing settings, or mutate old versions.

## Prota UI integration contract

The editor reads `tracking/events.json` and uses a **closable** “埋点” tab in its existing document drawer. Its marker layer stays in **Portal overlay**, not business CSS. Markers and cards link bidirectionally across nested iframes. Shared/ZIP viewers are read-only and use a pinned published snapshot. If the runtime lacks this tab, still generate the manifest and explicitly say visualization needs the editor integration; do not pretend the tab exists.
