# Component Map

Use this as a role-oriented index. For exact props, events, slots, and version-specific API details, consult the installed package and official documentation.

## App shell

Layout, Menu, Breadcrumb, Tabs, PageHeader when available.

## Layout

Grid.Row/Grid.Col, Space, Divider, ResizeBox.

## Data

Table, List, Descriptions, Statistic, Tag, Badge, Avatar, Timeline, Progress, Tree.

## Forms

Form/Form.Item, Input, Input.Search, Select/Select.Option, Cascader, Checkbox, Radio, Switch, Slider, DatePicker, TimePicker, Upload.

## Overlays

Modal, Drawer, Dropdown, Trigger, Popover, Tooltip.

## Feedback

Message, Notification, Alert, Spin, Skeleton, Empty, Result.

## Actions

Button, Link, Dropdown, Popconfirm, Pagination.

## Visual/data

Card, Typography, Image, Carousel, charts through a lightweight compatible chart lib only when needed.

## Selection heuristics

- Prefer one primary navigation primitive, not nested nav patterns for visual richness.
- Use a table only when row/column comparison matters; otherwise use cards/lists.
- Use a drawer/sheet/popup for context-preserving secondary tasks.
- Use a dialog only for focused decisions or short forms.
- Show one loading style consistently.
- Keep status vocabulary small and meaningful.
- Do not add a chart when the same insight is clearer as a number, progress, or table.
