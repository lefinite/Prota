---
name: demo-event-tracking
description: Analyze every reachable business screen, route, dialog and board in the current Demo version; select decision-useful events; generate a company-format manifest with visible bindings, screen coverage and Excel review. Use for 生成埋点、埋点方案、埋点可视化 or /demo-event-tracking. This is a specification, not production collection.
---

# Demo Event Tracking

Generate a restrained, complete measurement specification for the **current Demo version**. Use schema v2. Do not add telemetry listeners, SDKs or backend writes. Invisible stable DOM attributes are allowed for review only.

## 1. Resolve scope and inventory the entire flow

1. Resolve current `projectId`, `pageId`, `version` from Portal run context, falling back to the configured workspace's `data/projects.json`. Do not select a historical version or assume a product ID.
2. Read the full version entry HTML, imported JS/CSS, existing tracking manifest, PRD and annotations. For infinite canvas read the latest `canvas-data.js` and **every business board**, including its imported components. Do not change shared editor code or unsaved canvas layout.
3. Build the `screens` inventory **before choosing events**. A Portal page or board is a container, not necessarily one business screen. Follow local hrefs, location changes, hash/query routers, React/Vue routes, tab-driven business panels, JS view switches and dialogs. Read destination code recursively, with a visited set, within this version. Login, register, password recovery, verification, success and failure states must be considered separately where present. Never stop at the initial screenshot or one index.html.
4. Exercise reachable transitions in a browser when available. Record each distinct screen's path, board identity, hash/query or unique visible root anchor, and safe navigation steps when a URL alone cannot open it. Use only navigation clicks, not submit/delete/payment actions. Dynamic navigation should bind stable controls in the source that renders them.
5. Preserve every discovered screen in `screens`, even one with zero valuable events. Use `status: reviewed` and a reason for zero events. If access needs unavailable auth/data, mark `needs_review` with the precise reason. Never claim complete coverage based on the first screen. Report unavailable browser validation honestly.

## 2. Select value, with a budget per business screen

Every candidate must have a specific **product question**, **actionable decision** and exact signal. Score:

| Factor | Points |
|---|---|
| Business impact / user outcome | 0–3 |
| Actionability / decision utility | 0–3 |
| Measurement gap | 0–2 |
| Implementation/maintenance cost | subtract 0–2 |
| Redundancy / derivable signal | subtract 0–2 |

Keep scores ≥5. ≥7 is P0, 5–6 is P1. Prefer 3–8 events **per meaningful business screen**, allow zero, maximum 12 per screen. Above 8 needs `screen.budgetReason`. This is not a 12-event limit for the entire flow; it must not starve later screens. Consolidate shared semantic events within the same screen using bounded parameters or multiple anchors; do not create an event per cosmetic button. Track meaningful page exposure, main actions, actual outcomes and useful failure diagnoses. Exclude hover/focus/typing/minor scroll, duplicate click/result signals and sensitive input. Do not equate submit click with success.

## 3. Apply company naming and parameter format

Read [references/company-format.md](references/company-format.md) and [references/contract.md](references/contract.md) entirely.

First read [references/existing-pages.md](references/existing-pages.md), then retrieve only matching page records from [references/existing-tracking-catalog.json](references/existing-tracking-catalog.json). This is the saved company workbook + current prototype naming reference; it does not depend on the original attachment being available.

**Existing-page reuse is mandatory:** match by business purpose, content and navigation, not merely the Portal title. Reuse an existing page's English code and Chinese page name; reuse semantically identical block/element codes and matching parameter definitions. Redesigns, new versions and new canvas boards do not create a new business page identity. Priority: current explicit user naming > company registered records > valid current-version manifest > saved prototype snapshot > new proposal. If sources disagree, inspect the semantic match and surface ambiguity rather than silently renaming. Only genuinely new business pages receive new codes. Do not copy every reference event without evaluating value. Read the index's conflict/update rules before changing a previously used name.


- For this user's company tracking, **always** use `rdify` / `Readify` and `ainvest` / `Ainvest`. These are allocated classification and business-line constants, not values inferred from the Portal project, login/account feature or page title. Never substitute `auth`, `account`, a product slug or a translated label.
- Page ID/key: `rdify_ainvest_{page}`; Chinese name: `Readify_Ainvest_{页面名称}`. Example: `rdify_ainvest_loginPage` / `Readify_Ainvest_登录页`.
- Element ID/key: `rdify_ainvest_{page}_{block}_{element}`; Chinese name has the same five levels. Example: `rdify_ainvest_reader_floatActionBar_askAI` / `Readify_Ainvest_阅读器_悬浮操作栏_AI问答`.
- A block is a real visual group shared by several controls (登录区、筛选区、底栏、悬浮操作栏), not the event action or an arbitrary extra level. An element is the actual smallest control (button, switch, row, link). Preserve approved terms such as `askAI`; do not mechanically append Btn to every element.
- Platform is **only a page-name convention**, not another namespace or ID segment: APP uses the established unprefixed page code, Web commonly uses `webHome` / `webReader`, Chrome extension uses established `extBar` or another ext-prefixed page name. Do not add app_, web_ or chrome_ segments, infer platform from the outer canvas, or change approved page names to satisfy metadata. Existing platform metadata is an export compatibility hint only.
- `name` stores the user-facing company 埋点ID/key. Internal `id` remains stable snake_case for bindings; numeric `registrationId` is assigned by the company platform and stays empty for unregistered events. Do not confuse or rename these three identities.
- Operation (`show`, `click`, etc.) is separate from the key. Fields describe this event, never add ID levels. Reuse the reference field with matching semantics and casing; do not blindly replace every dimension by a generic type/value or invent per-button fields. Read the field selection guidance in company-format.md. Specify type, meaning, source, enum meanings, units/timezone where relevant. Do not include account/password/code raw values.

## 4. Write only the current version

1. Write `tracking/events.json` schema v2 in the current version. Include naming, complete screens, retained events, value scores and omitted candidates.
2. Attach stable `data-prota-track-id` anchors safely to business source, including dynamically rendered views; use a unique selector only as fallback. A target identifies its actual HTML document, board and business screen. Identical selectors across screens are not interchangeable. Hidden or wrong-route elements must not resolve.
3. Page exposure may anchor a uniquely visible screen root. Outcomes with no entity have `targets: []`; never bind success to a submit button just to show a marker.
4. Preserve manual review decisions (`reviewStatus`, `reviewedByUser`) and `review.deletedEvents` tombstones. Do not recreate a user-deleted event on regeneration unless the user asks to restore it. Confirmed events/pages should not be reset to needs_review merely because their screen is currently off-route; actual source changes that invalidate a binding may require renewed review.
5. Regeneration preserves semantic IDs, approved company keys and reviewed configuration. When upgrading v1, retain the internal id but map its old snake_case name to the company key; do not mistake an old internal name for an approved company registration. Merge all screens rather than overwriting later screens with the entry screen. Mark ambiguous/vanished anchors `needs_review`. Preserve unrelated files, runtime and historical versions. Never write business manifests to product templates.

## 5. Validate and hand off

1. Run `node .claude/skills/demo-event-tracking/scripts/validate.mjs <absolute-events.json-path>`. Fix failures.
2. In the browser, navigate **each reachable screen**, checking its own anchors resolve once, wrong-screen same-name anchors do not match, new document loads rebind, and tracked navigation still works. Verify reverse list-to-screen location for URL-based and state-based views. Note any screens that cannot be checked.
3. Report screen coverage, retained events and unresolved bindings concisely. The Portal's 埋点 tab groups by business screen, shows company keys/parameters, and downloads Excel. Markers live in the Portal overlay, not business CSS.
4. This is a specification. Do not claim events were sent. Shares and ZIP must use the pinned current-version manifest.
