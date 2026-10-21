---
name: forest-calm
label: 森系自然
category: minimal
description: 苔藓绿 + 米白的自然治愈风，适合健康、冥想、可持续类产品。
accent: "#4d7c0f"
surface: "#f7f5ed"
text: "#1f2937"
muted: "#6b7280"
border: "#e5e1d5"
font:
  family: "'Inter', sans-serif"
  heading: "'Fraunces', 'Noto Serif SC', serif"
radius: 14
spacing: 8
---

# 森系自然 (Forest Calm)

> 灵感来源：Calm / Headspace / Patagonia 的自然系品牌。

## 设计原则
- **自然色阶**：苔藓绿主色，米白底，呼应森林与原野。
- **柔衬标题**：标题使用 Fraunces / Noto Serif SC 营造温柔感。
- **大圆角 + 留白**：圆角 ≥ 14px，节奏松弛不紧绷。

## 颜色

| Token | 值 | 用途 |
| --- | --- | --- |
| `--color-bg` | `#f7f5ed` | 米黄底 |
| `--color-surface` | `#ffffff` | 卡片 |
| `--color-text` | `#1f2937` | 主文本 |
| `--color-muted` | `#6b7280` | 辅助 |
| `--color-border` | `#e5e1d5` | 分割 |
| `--color-accent` | `#4d7c0f` | 苔藓绿 |
| `--color-accent-soft` | `rgba(77, 124, 15, 0.12)` | 弱化 |

## 排版

- H1：`Fraunces / 600 / 36px / -0.01em`
- 正文：`Inter / 400 / 15px / line-height 1.7`

## 圆角 & 阴影

- 卡片：`18px`，按钮：`12px`。
- 阴影：`0 6px 20px rgba(77, 124, 15, 0.08)`，柔和不锐利。

## 组件提示

- 主按钮：苔藓绿底白字 + 大圆角。
- 卡片：白底 + 米黄背景上的 hairline。
- 图标：使用线性 1.6 stroke，避免厚重填色图标。
