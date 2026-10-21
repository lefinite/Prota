# Component Map

Use this as a role-oriented index. For exact props, events, slots, and version-specific API details, consult the installed package and official documentation.

## App shell

Sidebar, NavigationMenu, Breadcrumb, Tabs, Sheet.

## Content containers

Card, Separator, ScrollArea, Resizable, Accordion, Collapsible.

## Actions

Button, ButtonGroup, DropdownMenu, ContextMenu, Command.

## Data

Table, Data Table pattern, Badge, Avatar, Chart, Progress.

## Forms

Field, FieldGroup, Input, Select, Combobox, Checkbox, RadioGroup, Switch, Slider, Textarea, InputOTP.

## Overlays

Dialog, AlertDialog, Sheet, Drawer, Popover, HoverCard, Tooltip.

## Feedback

Alert, Empty, Skeleton, Spinner, Toast/Sonner according to base.

## AI/chat

MessageScroller, Message, Bubble, Attachment, Marker when available in the installed version.

## Selection heuristics

- Prefer one primary navigation primitive, not nested nav patterns for visual richness.
- Use a table only when row/column comparison matters; otherwise use cards/lists.
- Use a drawer/sheet/popup for context-preserving secondary tasks.
- Use a dialog only for focused decisions or short forms.
- Show one loading style consistently.
- Keep status vocabulary small and meaningful.
- Do not add a chart when the same insight is clearer as a number, progress, or table.
