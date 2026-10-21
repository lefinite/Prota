# Agent module boundaries

This directory keeps the portal agent code split away from `portal/shell.js`.

- `constants.js`: UI copy and static fallbacks used by the workbench.
- `api.js`: the only browser-side gateway client for `/api/agent/*`.
- `events.js`: SSE event parsing helpers.
- `run-routes.js`: maps run kinds to gateway endpoints.
- `state.js`: run state defaults and terminal-state checks.
- `provider-config.js`: provider presets, saved provider records, active/selected provider behavior, and config drafts.
- `index.js`: exposes the module through `window.ReadifyAgent`.

`portal/shell.js` should stay responsible for page UI orchestration only. It can call `ReadifyAgent`, render controls, and bind events, but agent gateway routes, provider persistence, SSE parsing, and run-state rules belong here.

Provider selection has two separate concepts:

- selected provider: the provider currently shown in the config editor.
- active provider: the provider used by new sessions and runs.

Opening historical sessions must not mutate the active provider. Session provider data can be shown as context, but provider edits should only become active through the explicit "use provider" action.
