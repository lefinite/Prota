# Component Map

Use this as a role-oriented index. For exact props/events/slots/version behavior, consult current official docs, installed typings, or the framework’s official AI resources.

## App structure

Layout, Menu/HeadMenu, Breadcrumb, Tabs, Anchor, Steps.

## Surfaces

Card, Collapse, Divider, Space, Watermark when genuinely needed.

## Actions

Button, Dropdown, Popup, Popconfirm.

## Data

Table, EnhancedTable, List, Descriptions, Statistic, Tag, Badge, Avatar, Timeline, Progress, Tree.

## Forms

Form, Input, InputNumber, Select, Cascader, TreeSelect, AutoComplete, Checkbox, Radio, Switch, Slider, DatePicker, TimePicker, Upload, Transfer.

## Overlays

Dialog, Drawer, Popup, Tooltip, Popconfirm.

## Feedback

MessagePlugin, NotificationPlugin, Loading, Skeleton, Alert, Guide.

## Navigation/data utility

Pagination, Calendar, Swiper where appropriate.

## Selection heuristics

- Choose one primary navigation model.
- Use tables only when row/column comparison matters.
- Use context-preserving overlays for short secondary tasks.
- Use dialogs for focused decisions, not as generic page containers.
- Keep one consistent feedback/loading pattern.
- Add charts only when a visual relationship is more legible than a number, progress indicator, or list.
