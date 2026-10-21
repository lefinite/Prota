# Diagram specification

Use UTF-8 JSON.

## Visible text and layout constraints

- `label` is the only visible text inside a standard node. Use one line and one phrase; do not use subtitles, explanations, lists, colons, or `<br>`.
- Prefer 2-8 Chinese characters. The generator rejects node labels over 12 Chinese-width characters, edge labels over 8, participant labels over 10, and sequence messages over 16.
- `description` is optional source metadata. The generator preserves it in XML but does not render it.
- Prefer automatic `vertical` layout for business flows and state changes. It keeps forward connectors top-to-bottom and routes return connectors from the side.
- List `nodes` in intended reading order. Place shared results after their branches; point retry/return edges back to an earlier node so they are routed outside the forward ranks.
- Keep one page to 12 nodes or fewer, no more than 4 nodes on the same rank, and no more than 6 ranks. Simplify or use multiple pages when any limit is exceeded.
- Omit `x` and `y` unless automatic layout cannot express a deliberate grid. If coordinates are used, keep at least 80 px horizontal and 64 px vertical clearance between node bounds.

## Standard diagrams

Supported `type` values: `flow`, `state`, `architecture`. Supported layouts: `vertical`, `horizontal`, `architecture`.

```json
{
  "title": "阅读器锁屏逻辑",
  "type": "state",
  "layout": "vertical",
  "nodes": [
    {
      "id": "reading",
      "label": "阅读中",
      "description": "正常响应翻页与设置操作",
      "shape": "rounded",
      "tone": "primary"
    },
    {
      "id": "locked",
      "label": "已锁定",
      "shape": "diamond",
      "tone": "warning"
    }
  ],
  "edges": [
    {
      "source": "reading",
      "target": "locked",
      "label": "达到锁定条件",
      "dashed": false
    }
  ]
}
```

Optional node fields: `description`, `x`, `y`, `width`, `height`, `fill`, `stroke`. Supported shapes: `rounded`, `diamond`, `ellipse`, `document`. Supported tones: `primary`, `success`, `warning`, `danger`, `neutral`, `accent`.

## Sequence diagrams

```json
{
  "title": "分享流程",
  "type": "sequence",
  "participants": [
    { "id": "user", "label": "用户" },
    { "id": "portal", "label": "Prota 门户" },
    { "id": "bridge", "label": "Bridge 服务" }
  ],
  "messages": [
    { "from": "user", "to": "portal", "label": "点击分享" },
    { "from": "portal", "to": "bridge", "label": "提交页面与版本" },
    { "from": "bridge", "to": "portal", "label": "返回只读链接", "dashed": true }
  ]
}
```

## Multiple pages

Place page-specific fields inside `pages`:

```json
{
  "title": "功能逻辑",
  "pages": [
    { "name": "主流程", "type": "flow", "layout": "vertical", "nodes": [], "edges": [] },
    { "name": "服务时序", "type": "sequence", "participants": [], "messages": [] }
  ]
}
```
