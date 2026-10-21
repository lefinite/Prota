---
name: minimal-monochrome
label: 极简黑白
category: minimal
description: 以纯黑白灰为主的高可读极简风格，适合阅读类、文档类产品。
accent: "#111111"
surface: "#ffffff"
text: "#111111"
muted: "#6b7280"
border: "#e5e7eb"
font:
  family: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  heading: "'Outfit', sans-serif"
radius: 10
spacing: 8
---

# 极简黑白 (Minimal Monochrome)

> 灵感来源：Notion / Linear / Vercel 文档站的克制配色与排版。

## 设计原则
- **克制配色**：仅使用黑、白与三档灰阶，强调内容本身。
- **强排版层级**：标题用 Outfit，正文用 Inter，行高 1.6 保证长读舒适。
- **几何分割**：以 1px hairline border 与 8px 网格构建清晰节奏。

## 颜色

| Token | 值 | 用途 |
| --- | --- | --- |
| `--color-bg` | `#ffffff` | 卡片、容器背景 |
| `--color-surface` | `#fafafa` | 次级背景 |
| `--color-text` | `#111111` | 主要文本 |
| `--color-muted` | `#6b7280` | 辅助文本 |
| `--color-border` | `#e5e7eb` | 分割线 |
| `--color-accent` | `#111111` | 主要按钮、强调 |

## 排版

- 标题 H1：`Outfit / 600 / 36px / line-height 1.2`
- 标题 H2：`Outfit / 600 / 24px / line-height 1.3`
- 正文：`Inter / 400 / 15px / line-height 1.6`
- Caption：`Inter / 500 / 12px / uppercase / letter-spacing 0.06em`

## 间距

采用 `8px` 基础栅格，组件内部 padding 优先使用 `12 / 16 / 24`，组间间距使用 `24 / 32`。

## 圆角

- 按钮、输入框：`10px`
- 卡片：`14px`
- 大型容器：`20px`

## 阴影

仅在浮层（弹窗、下拉）使用 `0 8px 32px rgba(17, 17, 17, 0.08)`，普通卡片用 hairline border 而非阴影。

## 组件提示

- 按钮：黑底白字主按钮、白底黑边次按钮、无边框 ghost 按钮三档。
- 输入框：底部 hairline border，focus 时变为 2px 黑色。
- 卡片：1px border + 12px radius，避免使用渐变。
