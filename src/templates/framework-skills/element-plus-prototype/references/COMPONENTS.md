# Component Map

Use this as a role-oriented index. For exact props/events/slots/version behavior, consult current official docs, installed typings, or the framework’s official AI resources.

## App structure

Container, Header/Aside/Main/Footer, Menu, Breadcrumb, Tabs, Steps.

## Surfaces

Card, Collapse, Divider, Scrollbar, Splitter.

## Actions

Button, Dropdown, Popconfirm, Link.

## Data

Table, TableV2 when justified, Descriptions, Tree, TreeV2, Tag, Badge, Avatar, Statistic, Timeline, Progress.

## Forms

Form, Input, InputNumber, Select, SelectV2, Cascader, TreeSelect, Checkbox, Radio, Switch, Slider, DatePicker, TimePicker, Upload, Transfer.

## Overlays

Dialog, Drawer, Popover, Tooltip, Popconfirm.

## Feedback

Alert, Message, Notification, Loading, Skeleton, Empty, Result.

## Navigation/data utility

Pagination, Calendar, Tour.

## Selection heuristics

- Choose one primary navigation model.
- Use tables only when row/column comparison matters.
- Use context-preserving overlays for short secondary tasks.
- Use dialogs for focused decisions, not as generic page containers.
- Keep one consistent feedback/loading pattern.
- Add charts only when a visual relationship is more legible than a number, progress indicator, or list.
