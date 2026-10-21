# Page Recipes

These recipes describe **information architecture and interaction**, not fixed visual templates. Replace each generic role with the framework's native components listed in `COMPONENTS.md`.

## 1. Dashboard / operations console

- Left or top application navigation.
- Header row: title, one-sentence context, date/filter controls, primary action.
- 3–5 KPI cards maximum; prioritize one dominant metric.
- Main content: one chart/visual + one actionable data surface, not six tiny charts.
- Secondary panel: tasks, alerts, activity, or segment breakdown.
- Table rows need believable status, owner, time, and action data.
- Interaction: filter/segment changes should visibly update mock data or active state.

## 2. Settings / preferences

- Group settings by user mental model, not by component type.
- Desktop: side sub-navigation + content panel or clear stacked sections.
- Mobile: cells/cell groups with drill-in popups or sheets.
- Keep save behavior obvious: auto-save with feedback, or one fixed save action.
- Include disabled/help/destructive states only where they make product sense.

## 3. List + detail workflow

- Make the list scannable: avatar/icon, title, metadata, status, one important metric.
- Keep detail in a side sheet/drawer on desktop when the user can remain in context.
- On mobile, use full-screen popup/drill-in behavior or a dedicated visible detail state.
- Provide search/filter/sort only when they materially help the scenario.

## 4. AI / copilot workspace

- Separate conversation, context/tools, and result/artifact surfaces.
- The prompt composer is a primary product surface, not a tiny footer input.
- Show at least one tool/result/citation/state object so the AI page is not just bubbles.
- Use streaming/loading affordances only when they add clarity.
- Add useful suggested prompts for the initial/empty state.

## 5. Content / creator tool

- Strong content preview area.
- Metadata/edit controls in an adjacent inspector or bottom sheet.
- Clear publishing/status state.
- Use real thumbnails, titles, durations/counts, and category labels.
- Important edit operations must have local state feedback.

## 6. Commerce / order mobile page

- Product/service hero, price/key promise, options, reassurance, details.
- Persistent bottom action bar for primary conversion action.
- Picker/action sheet for variants; do not use desktop selects.
- Order/status pages should use a timeline/steps pattern plus detail cells.

## 7. Profile / account center mobile page

- Identity block at top, but do not overfill it with gradients and badges.
- One high-value summary region, then grouped cells for account actions.
- Put risky/destructive actions in a visually separate lower section.
- Bottom navigation appears only if this is one destination of a broader app.

## 8. Landing / product introduction

- One clear value proposition and primary CTA above the fold.
- Show the product UI itself early; avoid stock-illustration-only hero sections.
- Use 3–4 feature sections maximum in a one-page prototype.
- End with social proof, pricing/CTA, or a product-specific final action.
