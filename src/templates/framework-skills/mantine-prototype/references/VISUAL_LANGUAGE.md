# Visual Language — Mantine

## Intended character

Mantine should feel product-oriented rather than “component demo”. Use AppShell for strong application structure, Paper/Card for surface rhythm, Group/Stack instead of ad-hoc flex wrappers, and a small theme override for the product accent and radius. Mantine tolerates more color than shadcn, but keep accent usage purposeful.

## Hierarchy

- Give the page one dominant region and one dominant action.
- Use 2–3 surface levels maximum.
- Keep metadata quieter than content; keep destructive/status color rarer than brand color.
- Prefer alignment and spacing over borders as separators; use dividers/borders where the framework naturally does.

## Spacing

- Build from the framework's native spacing scale.
- Desktop: default section gaps should read as deliberate groups, not uniform 16px everywhere.
- Mobile: preserve 12–16px horizontal breathing room unless an edge-to-edge media/list pattern is intentional.

## Typography

- Use one font family unless the product already defines another.
- Titles are concise; avoid giant marketing typography inside application UIs.
- Tabular/KPI numbers may be larger, but do not make every card a hero metric.

## Color

- Pick one product accent and let the library's neutrals do most of the work.
- Status colors communicate state, not decoration.
- Dark mode is optional unless requested; do not spend prototype time implementing both themes by default.

## Motion

- Rely on the framework's built-in transitions.
- Add custom motion only when it explains a state change.
- Avoid decorative entrance animations on every card.

## Device-specific rule

Desktop: prioritize information scanability, stable navigation, strong page header hierarchy, efficient use of horizontal space, and keyboard/mouse-friendly density.
