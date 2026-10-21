---
name: glass-aurora
label: 极光玻璃
category: vibrant
description: 半透明玻璃质感 + 渐变光斑的现代华丽风，适合 AI 助手、品牌官网。
accent: "#a855f7"
accentSecondary: "#22d3ee"
surface: "rgba(255, 255, 255, 0.65)"
text: "#0f172a"
muted: "#475569"
border: "rgba(255, 255, 255, 0.45)"
font:
  family: "'Inter', sans-serif"
  heading: "'Outfit', sans-serif"
radius: 20
spacing: 8
---

# 极光玻璃 (Glass Aurora)

> 灵感来源：Apple visionOS / Arc Browser / Stripe 与 Vercel 营销页。

## 设计原则
- **玻璃形态**：所有卡片采用 `backdrop-filter: blur(28px)` + 半透明白底。
- **彩色光斑**：背景叠加紫 / 青 / 粉三色 radial gradient。
- **柔和深景**：避免硬边，圆角 ≥ 20px，过渡 cubic-bezier。

## 颜色

| Token | 值 | 用途 |
| --- | --- | --- |
| `--color-bg` | `linear-gradient(135deg, #ede9fe 0%, #dbeafe 50%, #fce7f3 100%)` | 渐变底 |
| `--color-surface` | `rgba(255, 255, 255, 0.65)` | 玻璃卡 |
| `--color-text` | `#0f172a` | 主文本 |
| `--color-muted` | `#475569` | 辅助 |
| `--color-border` | `rgba(255, 255, 255, 0.45)` | 玻璃边 |
| `--color-accent` | `#a855f7` | 紫主色 |
| `--color-accent-2` | `#22d3ee` | 青辅色 |

## 排版

- H1：`Outfit / 700 / 40px / -0.02em`，可加渐变 `-webkit-background-clip: text`。
- 正文：`Inter / 400 / 14px / line-height 1.65`

## 圆角 & 阴影

- 卡片：`24px` 圆角 + 双重阴影 `0 8px 32px rgba(31, 38, 135, 0.12)` + 内描边 `inset 0 1px 0 rgba(255,255,255,0.6)`。
- 按钮：`16px`，玻璃质感。

## 组件提示

- 主按钮：渐变紫青底 + 白字 + 柔光阴影。
- 卡片：玻璃容器 + 内描边高光，悬浮时柔和放大 `transform: translateY(-2px)`。
- 标签：胶囊形 + 玻璃白底 + 主色文字。
