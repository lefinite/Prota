---
name: indigo-focus
label: 靛蓝专注
category: vibrant
description: 以靛蓝紫为主色的现代生产力风格，适合 SaaS、协作工具、工作台。
accent: "#6366f1"
accentGlow: "rgba(99, 102, 241, 0.12)"
surface: "#ffffff"
text: "#1a1d24"
muted: "#6b7280"
border: "#e5e7eb"
font:
  family: "Inter, -apple-system, sans-serif"
  heading: "'Outfit', sans-serif"
radius: 12
spacing: 8
---

# 靛蓝专注 (Indigo Focus)

> 灵感来源：Linear / Notion / Stripe Dashboard 的现代 SaaS 视觉。

## 设计原则
- **品牌主色一以贯之**：所有强调态使用 Indigo 500。
- **柔光分层**：通过 hairline border + 极弱阴影制造层次。
- **节奏感强**：8/12/16/24/32 的尺度阶梯清晰可读。

## 颜色

| Token | 值 | 用途 |
| --- | --- | --- |
| `--color-bg` | `#f8f9fb` | 页面背景 |
| `--color-surface` | `#ffffff` | 卡片背景 |
| `--color-text` | `#1a1d24` | 主文本 |
| `--color-muted` | `#6b7280` | 辅助文本 |
| `--color-border` | `#e5e7eb` | 分割线 |
| `--color-accent` | `#6366f1` | 主色 |
| `--color-accent-soft` | `rgba(99, 102, 241, 0.12)` | 主色弱化 |

## 排版

- H1：`Outfit / 700 / 32px / -0.02em`
- H2：`Outfit / 600 / 22px`
- 正文：`Inter / 400 / 14px / line-height 1.6`

## 间距 & 圆角

- 基础栅格 `8px`，常用 `12/16/24`。
- 卡片圆角 `12px`，按钮 `10px`，输入框 `10px`。

## 阴影

- 卡片：`0 1px 2px rgba(15, 23, 42, 0.04)`
- Hover 浮起：`0 8px 24px rgba(99, 102, 241, 0.16)`
- 弹窗：`0 12px 40px rgba(15, 23, 42, 0.12)`

## 组件提示

- 主按钮：靛蓝实底，hover 时加 8px 阴影。
- 输入框：白底 + hairline border，focus 时 border + glow 都用 accent。
- 卡片：白底，hover 时轻微上浮，并显示 accent glow。
