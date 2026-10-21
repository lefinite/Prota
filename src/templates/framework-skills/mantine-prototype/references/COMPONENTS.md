# Component Map

Use this as a role-oriented index. For exact props, events, slots, and version-specific API details, consult the installed package and official documentation.

## App shell

AppShell, Burger, NavLink, Breadcrumbs, Tabs.

## Layout

Container, Grid, SimpleGrid, Flex, Group, Stack, Center, Box.

## Surfaces

Paper, Card, Accordion, Spoiler, ScrollArea, Divider.

## Data

Table, Badge, Avatar, Indicator, Progress, RingProgress, Timeline, charts via @mantine/charts.

## Forms

TextInput, NumberInput, Select, MultiSelect, Combobox, Checkbox, Radio, Switch, Slider, SegmentedControl, Textarea, Date/Time packages when needed.

## Overlays

Modal, Drawer, Menu, Popover, HoverCard, Tooltip.

## Feedback

Alert, Notification/notifications package when needed, Loader, Skeleton, Progress.

## Navigation/actions

Button, ActionIcon, Pagination, Stepper, Anchor.

## Selection heuristics

- Prefer one primary navigation primitive, not nested nav patterns for visual richness.
- Use a table only when row/column comparison matters; otherwise use cards/lists.
- Use a drawer/sheet/popup for context-preserving secondary tasks.
- Use a dialog only for focused decisions or short forms.
- Show one loading style consistently.
- Keep status vocabulary small and meaningful.
- Do not add a chart when the same insight is clearer as a number, progress, or table.
