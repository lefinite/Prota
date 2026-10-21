# Component Map

Use this as a role-oriented index. For exact props, events, slots, and version-specific API details, consult the installed package and official documentation.

## App shell

AppBar, Toolbar, Drawer, Tabs, Breadcrumbs, BottomNavigation for responsive variants.

## Layout

Box, Stack, Grid, Container.

## Surfaces

Paper, Card, Accordion, Divider.

## Data

Table, Chip, Avatar, Badge, List, Timeline via lab/X only when appropriate, Data Grid only if the prototype truly needs advanced grid behavior.

## Forms

TextField, Select, Autocomplete, Checkbox, Radio, Switch, Slider, Rating.

## Overlays

Dialog, Drawer, Menu, Popover, Tooltip.

## Feedback

Alert, Snackbar, CircularProgress, LinearProgress, Skeleton.

## Navigation/actions

Button, IconButton, SpeedDial, Pagination, Stepper, Link.

## Data viz

MUI X Charts only when needed; keep licensing/tier assumptions out of basic prototypes.

## Selection heuristics

- Prefer one primary navigation primitive, not nested nav patterns for visual richness.
- Use a table only when row/column comparison matters; otherwise use cards/lists.
- Use a drawer/sheet/popup for context-preserving secondary tasks.
- Use a dialog only for focused decisions or short forms.
- Show one loading style consistently.
- Keep status vocabulary small and meaningful.
- Do not add a chart when the same insight is clearer as a number, progress, or table.
