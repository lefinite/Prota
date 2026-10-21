// 星码 · GitHub（Dark）— 页面交互
// 状态栏时间逻辑来自 mobile-frame，原样保留。

const statusTime = document.getElementById("statusTime");

function updateStatusTime() {
  if (!statusTime) return;

  const now = new Date();
  statusTime.textContent = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

updateStatusTime();
setInterval(updateStatusTime, 30000);

/* ===== toast ===== */
const toast = document.getElementById("toast");
let toastTimer = null;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-show"), 1800);
}

/* ===== 通用：data-toast 按钮 ===== */
document.querySelectorAll("[data-toast]").forEach((btn) => {
  btn.addEventListener("click", () => showToast(btn.dataset.toast));
});

/* ===== 提交热力图：确定性生成 16 周 × 7 天 ===== */
(function buildHeatmap() {
  const heat = document.getElementById("heatmap");
  if (!heat) return;

  const WEEKS = 16;
  const DAYS = 7;
  const frag = document.createDocumentFragment();

  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < DAYS; d++) {
      const cell = document.createElement("i");
      const seed = Math.abs(Math.sin((w * 7 + d + 3) * 12.9898) * 43758.5453) % 1;
      let level = Math.floor(seed * 5);
      if (w < 2 && level > 1) level = level % 2; // 早期偏淡
      if (w >= 13 && level < 2) level = 2; // 近三周保持活跃
      if (w === 15 && level < 3) level = 3; // 本周冲刺（连续 46 天）
      cell.dataset.l = String(level);
      cell.style.animationDelay = `${(w * 7 + d) * 3}ms`;
      frag.appendChild(cell);
    }
  }

  heat.appendChild(frag);
})();

/* ===== chip 筛选（打开 / 已合并 / 草稿） ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const chips = document.querySelectorAll(".chip");

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    feedItems.forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 关注 toggle ===== */
document.querySelectorAll(".feed-item__watch").forEach((watch) => {
  watch.addEventListener("click", () => {
    const on = watch.classList.toggle("is-on");
    watch.setAttribute("aria-pressed", String(on));
    showToast(on ? "已关注，有动态会推送" : "已取消关注");
  });
});

const feedList = document.getElementById("feedList");
const quickInput = document.getElementById("quickInput");

const OPEN_STATE_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /></svg>';
const WATCH_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="2.8" /></svg>';

/* ===== 合并拉取请求：把最上面的 open 行翻成 merged ===== */
const mergeBtn = document.getElementById("mergeBtn");

mergeBtn.addEventListener("click", () => {
  const target = feedList.querySelector('li[data-kind="open"]');
  if (!target) {
    showToast("当前没有可合并的拉取请求");
    return;
  }

  target.dataset.kind = "merged";
  const state = target.querySelector(".feed-item__state");
  state.className = "feed-item__state feed-item__state--merged";
  state.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="7" cy="6" r="3" /><circle cx="7" cy="18" r="3" /><path d="M7 9v6" /><path d="M10 12h4a4 4 0 0 0 4-4V7" /></svg>';

  const name = target.querySelector(".feed-item__name").textContent;
  const meta = target.querySelector(".feed-item__meta");
  meta.innerHTML = `${meta.textContent.split(" · ")[0]} · 已于刚刚合并 <em class="feed-item__chip" data-tone="merged">已合并</em>`;

  showToast(`已合并「${name}」 · 分支已删除`);
});

/* ===== 新建议题：写入 Feed 顶部 ===== */
function createIssue() {
  const text = (quickInput.value || "").trim() || "搜索结果高亮偶发丢失";
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "open";
  li.innerHTML = `
    <span class="feed-item__state feed-item__state--open" aria-hidden="true">${OPEN_STATE_SVG}</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">#143 · 你 · 刚刚 <em class="feed-item__chip" data-tone="accent">新</em></span>
    </div>
    <b class="feed-item__count">0</b>
    <button class="feed-item__watch" type="button" aria-label="关注 #143" aria-pressed="false">${WATCH_SVG}</button>`;
  li.querySelector(".feed-item__name").textContent = text;
  li.querySelector(".feed-item__watch").addEventListener("click", (e) => {
    const watch = e.currentTarget;
    const on = watch.classList.toggle("is-on");
    watch.setAttribute("aria-pressed", String(on));
    showToast(on ? "已关注，有动态会推送" : "已取消关注");
  });
  feedList.prepend(li);
  quickInput.value = "";
  showToast("议题 #143 已创建 · 已指派给你");
}

document.getElementById("issueBtn").addEventListener("click", createIssue);
quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") createIssue();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "请求") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "新建") {
      quickInput.focus();
      showToast("输入标题后回车，快速建议题");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
