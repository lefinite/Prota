---
name: sunset-warm
label: 暖橘晚霞
category: vibrant
description: 以珊瑚橘 + 粉桃为主色的活力风格，适合 C 端消费、内容、社交类应用。
accent: "#fb7185"
accentSecondary: "#fbbf24"
surface: "#fff7ed"
text: "#1f2937"
muted: "#78716c"
border: "#fed7aa"
font:
  family: "'Plus Jakarta Sans', 'Inter', sans-serif"
  heading: "'Plus Jakarta Sans', sans-serif"
radius: 16
spacing: 8
---

# 暖橘晚霞 (Sunset Warm)

> 灵感来源：Airbnb / Duolingo / Gumroad 的暖系消费类产品。

## 设计原则
- **暖色主导**：珊瑚橘作为主色，金黄作为高光。
- **大圆角 + 友好**：圆角 ≥ 16px，营造亲和力。
- **插画感**：鼓励使用 emoji 与简单装饰图形。

## 颜色

| Token | 值 | 用途 |
| --- | --- | --- |
| `--color-bg` | `#fff7ed` | 暖白底 |
| `--color-surface` | `#ffffff` | 卡片背景 |
| `--color-text` | `#1f2937` | 主文本 |
| `--color-muted` | `#78716c` | 辅助 |
| `--color-border` | `#fed7aa` | 暖色分割线 |
| `--color-accent` | `#fb7185` | 珊瑚主色 |
| `--color-accent-2` | `#fbbf24` | 金黄辅色 |

## 排版

- H1：`Plus Jakarta Sans / 700 / 34px`
- 正文：`Plus Jakarta Sans / 400 / 15px / line-height 1.65`

## 圆角 & 阴影

- 卡片：`20px`
- 按钮：`14px`
- 阴影：`0 10px 30px rgba(251, 113, 133, 0.18)`，hover 时增强。

## 组件提示

- 按钮：实底珊瑚橘 + 大圆角，可选金黄渐变作为高光。
- 卡片：白色 + 暖色 hairline，hover 上浮带柔光。
- Tag/Badge：圆角胶囊形，使用 accent-soft 背景。
