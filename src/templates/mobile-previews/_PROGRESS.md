# Mobile Previews · 进度清单

> 目标：158 个设计系统全部产出，落盘 `src/templates/mobile-previews/{id}/`（自包含 index.html + styles.css + app.js）
> 配方见 `_RECIPE.md`；每个页面先调用 frontend-design skill 后产出。
> 本次为重新生成（旧版备份在 mobile-previews.zip），执行方式：主会话 + 并发子 Agent 混合。
> 2026-08-16 修订：应用户要求，已将全部 121 页 tabbar 的中央凸起 FAB 拍平为普通 tab（去凸出样式 + 补文字标签），JS 选择器同步修正（bmw-m / lamborghini）。

## ✅ 全部完成（158/158）

agentic airbnb airtable ant apple application arc artistic atelier-zero bento binance bmw bmw-m bold brutalism bugatti cafe cal canva cisco claude clay claymorphism clean clickhouse cohere coinbase colorful composio contemporary corporate cosmic creative cursor dashboard default discord dithered doodle dramatic duolingo editorial editorial-serif elegant elevenlabs energetic enterprise expo expressive fantasy ferrari figma flat forest-calm framer friendly futuristic github glass-aurora glassmorphism gradient hashicorp hud huggingface ibm indigo-focus intercom kami kraken lamborghini levels linear-app lingo loom lovable luxury mastercard material meta midnight-terminal minimal minimal-monochrome minimax mintlify miro mission-control mistral-ai modern mongodb mono mono-blue-print neobrutalism neon neumorphism nike notion nvidia ollama openai opencode-ai pacman paper perplexity perspective pinterest playstation posthog premium professional publication raycast refined renault replicate resend retro revolut runwayml sanity sentry shadcn shopify simple skeumorphism slack sleek spacex spacious spotify starbucks storytelling stripe sunset-warm supabase superhuman tesla tetris theverge together-ai totality-festival trading-terminal uber urdu vercel vibrant vintage vodafone voltagent warm-editorial warp webex webflow wechat wired wise x-ai xiaohongshu zapier

## 最终校验（全部通过）
- [x] 158 目录 × 3 文件（index.html / styles.css / app.js）齐全
- [x] 158 个 app.js 全部通过 node --check
- [x] 手机壳骨架标记齐全（statusTime / appContent / toast）
- [x] 无外部 CDN、无跨目录引用（仅 ./styles.css 与 ./app.js）
- [x] 全部 styles.css 含 :root token、隐藏滚动条规则、prefers-reduced-motion、:focus-visible
- [x] 总计 6.1MB · 474 个文件

## 生成方式
- 主会话亲自产出：default（活样本）+ 63 个系统
- 并发子 Agent 产出：95 个系统（frontend-design skill 为主审）
- 注：子 Agent 环境差异较大（部分无文件工具、部分遇 429 限流），失败批次均由主会话补齐
