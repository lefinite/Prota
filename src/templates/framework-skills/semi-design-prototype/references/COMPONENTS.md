# Component Map

Use this as a role-oriented index. For exact props, events, slots, and version-specific API details, consult the installed package and official documentation.

## App shell

Layout, Nav, Breadcrumb, Tabs, Anchor.

## Layout/surfaces

Card, Collapse, Divider, Space, SplitButton.

## Data

Table, Descriptions, List, Tree, Tag, Badge, Avatar, Timeline, Progress.

## Forms

Form, Input, Select, AutoComplete, Cascader, Checkbox, Radio, Switch, Slider, DatePicker, TimePicker, Upload.

## Overlays

Modal, SideSheet, Popover, Dropdown, Tooltip.

## Feedback

Toast, Notification, Banner, Spin, Skeleton, Empty.

## AI

AI-oriented components and chat primitives when present in the installed Semi version; verify via official docs/MCP before use.

## Content

Typography, Image, Carousel, Highlight, Markdown-oriented composition as needed.

## Selection heuristics

- Prefer one primary navigation primitive, not nested nav patterns for visual richness.
- Use a table only when row/column comparison matters; otherwise use cards/lists.
- Use a drawer/sheet/popup for context-preserving secondary tasks.
- Use a dialog only for focused decisions or short forms.
- Show one loading style consistently.
- Keep status vocabulary small and meaningful.
- Do not add a chart when the same insight is clearer as a number, progress, or table.
