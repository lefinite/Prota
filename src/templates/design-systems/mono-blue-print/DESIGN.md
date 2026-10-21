---
name: mono-blueprint
label: 蓝图工程
category: minimal
description: 工程蓝图风的精确网格与天蓝主色，适合工程、CAD、AI Builder 类工具。
accent: "#0ea5e9"
surface: "#ffffff"
text: "#0f172a"
muted: "#64748b"
border: "#cbd5e1"
font:
  family: "'Inter', sans-serif"
  heading: "'Outfit', sans-serif"
  mono: "'JetBrains Mono', monospace"
radius: 8
spacing: 8
---

# 蓝图工程 (Mono Blueprint)

> 灵感来源：Figma / Excalidraw / Linear Project / GitHub Repository 视图。

## 设计原则
- **网格秩序**：所有组件对齐到 4px 网格，强调秩序感。
- **天蓝高亮**：所有交互态使用 Sky 500 作为强调色。
- **数据感**：等宽字体 + 标签 + 角标，营造工程严谨感。

## 颜色

| Token | 值 | 用途 |
| --- | --- | --- |
| `--color-bg` | `#f8fafc` | 页面底 |
| `--color-surface` | `#ffffff` | 卡片 |
| `--color-text` | `#0f172a` | 主文本 |
| `--color-muted` | `#64748b` | 辅助 |
| `--color-border` | `#cbd5e1` | 网格分割 |
| `--color-accent` | `#0ea5e9` | 天蓝主色 |

## 排版

- H1：`Outfit / 600 / 26px`
- 正文：`Inter / 400 / 14px / line-height 1.55`
- 数据/ID：`JetBrains Mono / 500 / 12px / uppercase`

## 圆角 & 阴影

- 圆角：`8px / 12px`
- 阴影：`0 1px 2px rgba(15, 23, 42, 0.04)` + `0 4px 16px rgba(15, 23, 42, 0.06)`

## 组件提示

- 表格：交替行 `#f8fafc` 底 + hairline。
- 按钮：天蓝实底 + 圆角 8px。
- 标签：等宽小字号 + 大写 + 颜色 dot。
