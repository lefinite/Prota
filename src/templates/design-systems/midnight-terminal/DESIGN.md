---
name: midnight-terminal
label: 暗夜终端
category: dark
description: 深蓝黑底 + 青绿高亮的极客风，适合开发工具、Agent、数据面板。
accent: "#5eead4"
accentSecondary: "#38bdf8"
surface: "#0b1220"
surfaceAlt: "#0f172a"
text: "#e2e8f0"
muted: "#94a3b8"
border: "rgba(148, 163, 184, 0.16)"
font:
  family: "'Inter', sans-serif"
  heading: "'Outfit', sans-serif"
  mono: "'JetBrains Mono', 'Fira Code', monospace"
radius: 10
spacing: 8
---

# 暗夜终端 (Midnight Terminal)

> 灵感来源：Vercel / Linear Dark / Raycast / GitHub Copilot Workspace。

## 设计原则
- **深空底色**：以 `#0b1220` 为主，营造专注沉浸的氛围。
- **荧光高亮**：青绿/天蓝作为强调，呼应终端美学。
- **网格与噪点**：背景可叠加细网格或 SVG noise。

## 颜色

| Token | 值 | 用途 |
| --- | --- | --- |
| `--color-bg` | `#0b1220` | 主背景 |
| `--color-surface` | `#0f172a` | 卡片背景 |
| `--color-surface-2` | `#111a2e` | 次级表面 |
| `--color-text` | `#e2e8f0` | 主文本 |
| `--color-muted` | `#94a3b8` | 辅助 |
| `--color-border` | `rgba(148, 163, 184, 0.16)` | 分割 |
| `--color-accent` | `#5eead4` | 青绿主色 |
| `--color-accent-2` | `#38bdf8` | 天蓝辅色 |

## 排版

- H1：`Outfit / 700 / 30px / -0.01em`
- 正文：`Inter / 400 / 14px / line-height 1.65`
- 等宽：`JetBrains Mono / 500 / 13px` 用于代码与状态。

## 圆角 & 阴影

- 圆角：`10px / 14px`
- 高光：`0 0 0 1px rgba(94, 234, 212, 0.18)` + `0 12px 40px rgba(94, 234, 212, 0.08)`

## 组件提示

- 主按钮：青绿描边 + 透明底，hover 时柔光发散。
- 卡片：`#0f172a` 底 + 细边 + 角落 corner 装饰（可选）。
- 状态标签：等宽字体 + 颜色点（绿=success、蓝=info、紫=pending）。
