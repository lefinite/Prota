# Prota tracking manifest v2

An inert version-scoped measurement specification at `src/pages/{projectId}/{pageId}/{version}/tracking/events.json`. v1 is readable for compatibility; new generation uses v2.

```json
{
  "schemaVersion": 2,
  "scope": {"projectId":"sample","pageId":"account","version":"v2","pageMode":"standard"},
  "naming": {
    "application":{"code":"rdify","label":"Readify"},
    "business":{"code":"ainvest","label":"Ainvest"},
    "platform":"web"
  },
  "screens":[
    {"id":"login","title":"登录页","code":"loginPage","path":"index.html","route":{"hash":"#login"},"anchor":{"method":"selector","value":"[data-view=login]"},"status":"reviewed"},
    {"id":"register","title":"注册","code":"registerPage","path":"register.html","status":"reviewed"},
    {"id":"recovery","title":"找回密码","code":"recoverPasswordPage","path":"index.html","route":{"hash":"#login"},"anchor":{"method":"selector","value":"[data-view=recovery]"},"navigation":[{"action":"click","anchor":{"method":"data-attribute","value":"open-recovery"}}],"status":"reviewed","reason":"保留关键提交，排除输入框焦点"}
  ],
  "events":[{
    "id":"login_submit","screenId":"login","name":"rdify_ainvest_loginPage_login_continue","title":"提交登录",
    "registrationId":"","controlType":"element",
    "block":{"code":"login","label":"登录"},"element":{"code":"continue","label":"继续"},
    "operations":["click"],"signal":"attempt","trigger":{"type":"submit","when":"主动提交有效表单；每次有效提交一次，不代表登录成功"},
    "purpose":"衡量登录尝试","question":"用户是否完成表单提交？","decision":"是否降低表单门槛",
    "score":{"impact":3,"actionability":3,"gap":2,"cost":1,"duplicate":0,"total":7},"priority":"P0",
    "parameters":[{"name":"loginMethod","type":"enum","meaning":"登录方式","allowedValues":["password","code"],"source":"当前选中的登录方式","notes":"不包含账号原文"}],
    "targets":[{"kind":"page","path":"index.html","anchor":{"method":"data-attribute","value":"login-submit"},"confidence":"high","status":"bound"}]
  }],
  "omitted":[{"screenId":"login","candidate":"password_focus","reason":"不能支持可行动决策"}]
}
```

## Scope, screens and navigation

- `scope` must match current directory, pageMode is standard/infinite-canvas.
- `naming.application` is fixed to `{code:"rdify",label:"Readify"}`; `naming.business` is fixed to `{code:"ainvest",label:"Ainvest"}` for this company workflow. Never derive either from feature scope. `platform` (app/web/plugin/other) is retained for reader compatibility/export only, not ID construction.
- Optional per-screen platform hints may group export sheets. APP/Web/ext distinction is a convention within the page code (loginPage / webHome / extBar), not a mandatory classification or extra key level. Preserve established page codes.
- `screens` inventories all distinct business screens across all boards, paths, routes and view switches. id is stable snake_case; title is human name, code is the naming segment. `path` is a local HTML path relative to this version; safe subdirectories are supported. Never use `..`, absolute URLs, protocols, queries or hashes inside path.
- Infinite canvas screens require boardId and nodeId when known. `path` may be the board entry or another local HTML document reached from it. Board identity is retained through navigation.
- `route.hash` and `route.search` distinguish URL states, including empty strings. `anchor` identifies a uniquely visible root to distinguish same-URL state-driven views. On view switches old hidden roots must not qualify.
- `navigation` is an optional ordered set (≤12) of `{action:"click",anchor:{method,value}}` navigation-only steps from the screen's path/route entry. No arbitrary JS, inputs, submit, delete or other consequential actions. The review UI can replay these to locate offscreen events. If a state cannot be safely reproduced mark the screen needs_review and explain.
- `status` reviewed/needs_review; pending requires reason. A zero-event reviewed screen includes reason. Above 8 retained events per screen requires budgetReason, maximum 12. No whole-flow 12-event cap. Runtime bound: ≤200 screens / 2400 events.

## Events and company keys

- id: stable internal snake_case identity, unique within manifest.
- name: exact company implementation key. Page: `rdify_ainvest_{page}`; element: `rdify_ainvest_{page}_{block}_{element}`. Chinese names use the parallel Readify_Ainvest prefix. A page has no block or element. An element has code/label for both.
- title is the concise human event name. Optional fullName preserves an approved full Chinese label; otherwise Excel composes application/business/page/block/element labels, matching the source workbook.
- registrationId: existing numeric platform assignment as a string, or empty/omitted. Never generate arbitrary numeric IDs.
- screenId references the owning screen. One semantic company key has one event record with multiple operations/targets as needed. Keys are unique, operations are unique within an event.
- operations: show/click/stay/start/slide/submit/result/error/change; operation is separate from key. trigger.type retains click/submit/view/result/error/change; trigger.when specifies transitions, timing and dedup.
- purpose/question/decision required. Score integer ranges: impact 0–3, actionability 0–3, gap 0–2, cost 0–2, duplicate 0–2. total = impact + actionability + gap - cost - duplicate; retain ≥5; priority P0 iff ≥7, else P1.
- parameters: 0–5, each name (camelCase or snake_case), type (string/int/number/boolean/enum), meaning, source; optional notes, operation (must be supported by event), allowedValues (2–20 for enum). Duplicate names are invalid. Avoid secrets/raw user input. Preserve established safe names and units.
- targets: array, may be empty for logical outcome events. kind page/canvas-board, path exactly equals owning screen path, boardId matches screen for boards, nodeId where known. anchor data-attribute/selector; preferred `data-prota-track-id` stable token. confidence high/medium/low; status bound/needs_review, low must be needs_review. One match in correct live document and screen required. Same selector in another route or board must not bind.
- Page exposure can bind a screen root. It must not intercept all clicks within that root.
- omitted: candidates with explicit reason and optional screenId.

## Lifecycle and display

Preserve semantic identities and unrelated objects; regenerate all screens, not just first screenshot. Do not mutate historical versions. Portal reloads on context change / Agent completion, rebinds new documents and gates markers by route/root visibility. Business clicks continue normally. Overlay markers/list locate each other. Excel is a true .xlsx, parameters per row. Published share/ZIP uses its pinned manifest; no live telemetry or author-local dependencies.

## Manual review and deletion

Event `reviewStatus` is `valid` or `needs_review`. Valid events have no visible normal-state badge. Human review is one way: unresolved events/pages can be confirmed valid; the review UI and API do not offer a reverse transition back to uncertain. A screen can be marked `status: reviewed`, `reviewedByUser: true` without rewriting bindings. Runtime absence on a different page is not a review failure. User-deleted events are removed from the ordered events array; `review.deletedEvents` retains `{event,index,deletedAt}` for undo and regeneration exclusion. Display numbers derive from the current array, never from stable IDs. Preserve these manual decisions on regeneration. Share/ZIP viewers remain read-only.
