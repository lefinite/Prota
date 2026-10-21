# Page Planning

Use this before implementation when the request is more than a trivial widget.

## Decide the page set

Write a short internal page map. Examples:

- `Projects` only: list, filters, create modal, side detail — one page is enough.
- `Products -> Product detail -> Variant settings`: use multiple pages/states because the information model changes substantially.
- `AI workspace`: conversation + context/result can stay in one workspace when simultaneous visibility is valuable.
- `Account settings`: one settings shell with grouped sections unless a section is complex enough to deserve drill-in.

The number of pages is a consequence of product intent, not a target metric.

## Page anatomy

For each page identify:
- purpose;
- entry context;
- dominant task;
- primary information;
- primary action;
- secondary action;
- success state;
- next destination.

## Mock-data standard

Mock data should tell a story. Use coherent names, dates, statuses, quantities, and relationships. For a list/detail prototype, detail data must match the selected list row. For dashboards, KPI values should be compatible with charts/tables rather than independent random numbers.

## Progressive fidelity

1. Correct structure and page boundaries.
2. Correct framework components.
3. Realistic data/content.
4. Working key interactions.
5. Visual polish and edge-state cleanup.

Do not spend time building production infrastructure before these five layers are convincing.
