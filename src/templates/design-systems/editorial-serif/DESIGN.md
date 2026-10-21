---
name: editorial-serif
label: 编辑衬线
category: editorial
description: 衬线标题 + 留白主导的杂志风排版，适合内容、出版、品牌叙事类页面。
accent: "#111827"
surface: "#fdfaf3"
text: "#1a1a1a"
muted: "#6b7280"
border: "#e5e1d5"
font:
  family: "'Source Serif 4', 'Noto Serif SC', Georgia, serif"
  heading: "'Source Serif 4', 'Noto Serif SC', serif"
  body: "'Inter', sans-serif"
radius: 4
spacing: 8
---

# 编辑衬线 (Editorial Serif)

> 灵感来源：The New York Times / Medium / Substack 的长读体验。

## 设计原则
- **衬线为骨**：标题统一使用 Source Serif 4 / Noto Serif SC。
- **大量留白**：内容左右留白 ≥ 80px，行宽控制在 70 字符内。
- **极弱装饰**：极少使用阴影、渐变，强调文本本身。

## 颜色

| Token | 值 | 用途 |
| --- | --- | --- |
| `--color-bg` | `#fdfaf3` | 米白纸感底 |
| `--color-surface` | `#ffffff` | 卡片背景 |
| `--color-text` | `#1a1a1a` | 主文本 |
| `--color-muted` | `#6b7280` | 辅助 |
| `--color-border` | `#e5e1d5` | 暖灰分割 |
| `--color-accent` | `#111827` | 强调（近黑） |

## 排版

- H1：`Source Serif 4 / 700 / 48px / line-height 1.15`
- H2：`Source Serif 4 / 600 / 28px`
- 正文：`Inter / 400 / 16px / line-height 1.75`
- 引言：`Source Serif 4 / italic / 20px`

## 间距 & 圆角

- 栅格 `8px`，section 间距用 `64 / 96`。
- 圆角统一 `4px`，按钮也用直角或极小圆角。

## 组件提示

- 按钮：黑色实心 + 直角；次按钮白底黑边 1px。
- 卡片：白底 + 暖灰 hairline，无阴影。
- 标签：全大写、字母间距 0.1em、小字号。
