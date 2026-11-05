# Prota Demo tracking manifest v1

This version-scoped artifact is an inert **measurement specification**, not live collection.

Path: `src/pages/{projectId}/{pageId}/{version}/tracking/events.json`.

## Example

```json
{
  "schemaVersion": 1,
  "scope": {
    "projectId": "sample",
    "pageId": "login",
    "version": "v2",
    "pageMode": "standard"
  },
  "events": [
    {
      "id": "login_submit",
      "name": "login_submit",
      "title": "提交登录",
      "purpose": "衡量用户是否尝试完成核心登录流程",
      "question": "用户到达登录页后是否真正尝试提交？",
      "decision": "是否需要降低登录表单操作门槛",
      "score": {
        "impact": 3,
        "actionability": 3,
        "gap": 2,
        "cost": 1,
        "duplicate": 0,
        "total": 7
      },
      "priority": "P0",
      "signal": "attempt",
      "trigger": { "type": "submit", "when": "主动提交有效的登录表单，不代表登录成功" },
      "parameters": [
        { "name": "method", "type": "enum", "allowedValues": ["password", "code"], "source": "当前登录方式，无账号内容" }
      ],
      "targets": [
        {
          "kind": "page",
          "path": "index.html",
          "anchor": { "method": "data-attribute", "value": "login-submit" },
          "confidence": "high",
          "status": "bound"
        }
      ]
    }
  ],
  "omitted": [
    { "candidate": "password_focus", "reason": "焦点次数不能支持可行动的产品决策" }
  ]
}
```

## Rules

- `scope` exactly matches the directory. `pageMode` is `standard` or `infinite-canvas`. Use the latter only when page metadata says `pageMode: "infinite-canvas"`.
- `events` is an ordered 0–12 array. Every event requires `id`, `name`, `title`, `purpose`, `question`, `decision`, `score`, `priority`, `signal`, `trigger`, `parameters`, `targets`.
- IDs and names are lower-case `snake_case` starting with a letter. `id` identifies this manifest entry. `name` is the implementation event name and may recur across different pages for identical semantics.
- `score.total = impact + actionability + gap - cost - duplicate`. All factors are bounded integers. Every event scores ≥5. `P0` iff ≥7, `P1` for 5–6.
- `signal` is `attempt`, `outcome`, `exposure`, `error`, or `engagement`. An attempted click/submit is not success. Use `targets: []` for outcomes/errors that lack a real visual target.
- `trigger.type` is `click`, `submit`, `view`, `result`, `error`, or `change`. `when` states the exact qualifying transition and dedup conditions.
- `parameters` contains 0–5 safe dimensions. Name is `snake_case`; type is `string`, `number`, `boolean`, or `enum`. Enums use 2–20 bounded `allowedValues`; every parameter has `source`. Exclude phone, email, password, token, raw input, full URL query, free text, and user content.
- Each target has `kind`, `path`, `anchor`, `confidence`, `status`. `kind=page` means ordinary Demo iframe; `canvas-board` means a nested board iframe, with required `boardId` and `nodeId` where known. Same CSS selector in two boards is never interchangeable.
- `path` identifies the actual iframe document: `index.html` for a normal page, `boards/{boardId}/index.html` for a board. The source of its DOM element can be an imported JS/JSX file, but this target path must still identify the iframe document. No absolute path, `..`, protocol URL, or editor template path.
- `anchor.method` is `data-attribute` (preferred) or `selector` (fallback). For the former `value="login-submit"` means `data-prota-track-id="login-submit"`. For the latter `value` is a CSS selector unique **within its specified iframe**, which needs browser validation.
- `confidence` is `high`, `medium`, or `low`. `status` is `bound` or `needs_review`. Low/missing/ambiguous locator must be `needs_review`, with no misleading badge.
- `omitted` contains candidate names and concrete rejection reasons. These do not count as events.

## Lifecycle

- Regeneration uses semantic IDs, not DOM order or timestamp; do not create noisy diffs or overwrite prior business versions.
- The existing version-copy procedure may copy the manifest to a new version. Reconcile the new version's interactions, update only that new copy, and mark vanished targets.
- Portal fetches `tracking/events.json` with cache-busting on context change and Agent completion. Invalid JSON is an error, not a false “zero events.”
- Visual markers are computed in the Portal overlay with existing iframe geometry and zoom clipping, never as CSS in the generated business page.
- The immutable static share payload contains the published manifest snapshot. ZIP includes the same manifest; its read-only viewer must not rely on author's local Prota.
- Logical events with no target appear as list-only cards; stale/ambiguous targets show “需确认”, never a guessed element.
