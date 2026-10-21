# Mobile Previews · 配方规范（给并发 Agent）

> 目标：为 `src/templates/design-systems/` 下**每一个**设计系统，基于 `mobile-frame` 手机壳，
> 设计一个**丰富、能体现该设计系统特色**的移动端 App 屏示例页。
> 落盘到 `src/templates/mobile-previews/{design-system-id}/`，每个目录完全自包含。

## 0. 你（子 Agent）每次必须做的事

1. **先调用 `frontend-design` skill**（用 Skill 工具，skill 名 `frontend-design`），把它当成你的设计主审。
2. 读取本配方 + `mobile-previews/default/`（活样本，三件套都看一遍）。
3. 读取分配给你的每个设计系统的 `DESIGN.md` 与 `tokens.css`（路径见任务）。
   - 若该设计系统**没有 `tokens.css`**，从 `data/templates.json` 里该 id 的 `preview` 字段取
     `background / surface / accent / accentSecondary / text / muted / border / fontHeading / fontBody / radius`，
     并据 `DESIGN.md` 推导 `--success/--warn/--danger` 等语义色与字阶。
4. 为每个设计系统产出一个**自包含**目录 `{id}/index.html + styles.css + app.js`。

## 1. 落盘结构（严格遵循，参考 web-framework-previews）

```
src/templates/mobile-previews/{design-system-id}/
├── index.html   ← 手机壳 + 丰富 App 内容
├── styles.css   ← 共享手机壳(保留) + 设计系统 :root token + 页面样式
└── app.js       ← 状态栏时间(保留) + 页面交互
```

- **严禁**跨目录引用 CSS/JS，只能 `./styles.css` 与 `./app.js`。
- **严禁**引用外部字体 CDN（除非该设计系统 DESIGN.md 明确给出可加载的 webfont，且必须能离线降级）。
  默认走系统字体栈 / `tokens.css` 里声明的 `--font-display / --font-body`。

## 2. 手机壳结构（index.html 必须保留，逐字保留这套骨架）

```
.demo-stage
  .phone-shell
    .phone-screen#phoneScreen
      .status-bar              ← 时间 #statusTime + 灵动岛 + 信号/电池图标
      main.app-content#appContent   ← 你的页面内容写这里
      nav.tabbar               ← 底部导航（可选但推荐）
      .toast#toast             ← 反馈条（可选）
```

- `styles.css` 的 `/* ===== Shared mobile frame ===== */` 区块**原样保留**，只把其中的
  `--phone-screen / --page-backdrop-* / --phone-shell-*` 改成与该设计系统协调的值。
- `app.js` 顶部的状态栏时间逻辑**原样保留**，再追加你的交互。

## 3. token 注入（styles.css 顶部 :root）

把该设计系统 `tokens.css` 的 `:root { … }` 整块**粘进**页面 `styles.css` 的 `:root`，
之后一律用 `var(--bg)`、`var(--accent)`、`var(--font-display)` 等引用，**不要再散写裸 hex**
（除手机外壳 backdrop 外，且 backdrop 要与设计系统配色协调）。
缺少的 token 用 `data/templates.json` 的 `preview` 值补齐。

## 4. 页面内容配方（每个设计系统都要"丰富 + 有特色"）

先为该设计系统**定一个具体 App 主题**（frontend-design 的 ground-it-in-the-subject），
主题要贴合该设计系统的气质，举例：

| 设计系统类型 | 推荐 App 主题 |
|---|---|
| fintech(coinbase/stripe/revolut) | 资产/支付/行情 |
| 编辑/出版(editorial/paper/kami) | 阅读器/杂志/长文 |
| 音乐媒体(spotify/vercel/cursor) | 播放器/歌单/内容流 |
| 开发/极客(vercel/midnight-terminal/ollama) | 终端/监控/部署 |
| 暖/生活方式(cafe/starbucks/airbnb) | 商家/预订/探索 |
| 极简/产品(default/notion/linear-app) | 任务/笔记/工作台 |
| 大胆/表现(brutalism/neon/vibrant) | 创作工具/社区 |
| 汽车高端(ferrari/tesla/lamborghini) | 车控/行程 |
| 其它 | 按气质自选，只要能压测该系统的色彩/字体/质感 |

无论选什么主题，**结构上必须包含**以下区块（保证每个设计系统的 token 都被压测、且可横向比较）：

1. **顶部品牌栏**：品牌字标 + 副标题 + 一个图标按钮（压测 display 字体 + accent 点缀）。
2. **Hero/核心卡**（signature）：把该设计系统最有辨识度的视觉收进这一屏的一个焦点
   （大数字 / 大图 / 强对比标题 / 主色块 / 特殊质感），体现"一个被记住的点"。
3. **2~3 张内容卡**（surface + border + radius + elevation）：压测卡片质感。
4. **列表/Feed**（3~6 条）：行内含图标/头像、标题、副信息、金额或状态徽标/chip。
5. **操作区**：主 CTA（accent 填充）+ 次按钮（描边/幽灵）+ 至少一个输入或筛选 chip。
6. **底部 Tab**：4~5 项，含一个可点击的高亮态（必要时含 FAB）。
7. **微交互（app.js）**：Tab 切换、chip 筛选、点赞/收藏 toggle、按钮 toast、进度条 grow 动画、
   `prefers-reduced-motion` 与 `:focus-visible` 都要照顾。

## 5. 质量门槛（frontend-design + 项目规约）

- **体现特色**：换设计系统后，主色、字体、圆角、质感、布局密度、signature 必须明显不同；
  禁止只换主色就交付。暗色系统就做暗色（backdrop/screen/text 全套反转）。
- **字体**：用该设计系统声明的 display/body 字体；中文走 `PingFang SC / Hiragino Sans GB` 兜底。
- **文案**：默认中文；若该设计系统是强英文品牌（vercel/coinbase…）可中英混排，但不要纯英文占位。
- **克制**：胆量集中在一个 signature，其余留白纪律化；移除不服务内容的装饰。
- **可运行**：`index.html` 双击在浏览器（及 iframe）里直接打开即正常显示、可交互。
- **无滚动条**：手机壳内一律不得出现可见滚动条（真机 App 观感）。`styles.css` 末尾固定追加：
  `* { scrollbar-width: none !important; } ::-webkit-scrollbar, *::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }`
  滚动能力保留，仅隐藏滚动条。
- **首屏非空**、无死按钮、无重复占位标题、无第二套设计系统痕迹。
- **自包含**：不引用 `mobile-frame/`、`web-frame/`、`design-systems/` 或其它预览目录。

## 6. 活样本

`mobile-previews/default/`（Neutral Modern → 晨光钱包 记账 App）是质量基线：
三件套都看一遍，照它的"骨架保留 + token 注入 + 七区块 + 微交互"节奏产出。

## 7. 完成自检（每个设计系统产完后逐条过）

- [ ] `{id}/index.html styles.css app.js` 三件齐全
- [ ] 手机壳骨架完整、状态栏时间正常
- [ ] `:root` 用的是该设计系统的 token，配色/字体/质感与该系统一致且有辨识度
- [ ] 七个区块齐全、signature 清晰
- [ ] Tab/chip/toast 等交互可点且有反馈
- [ ] 无跨目录引用、无裸 hex 满屏、reduced-motion/focus 已处理
