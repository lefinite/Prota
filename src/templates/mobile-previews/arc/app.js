// 拾光 · Arc — 页面交互
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

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ===== 主题切换（signature）：日落 / 暮紫 / 极光 ===== */
const THEMES = {
  sunset: { a: "var(--sunset-a)", b: "var(--sunset-b)", name: "日落" },
  twilight: { a: "var(--twilight-a)", b: "var(--twilight-b)", name: "暮紫" },
  aurora: { a: "var(--aurora-a)", b: "var(--aurora-b)", name: "极光" }
};

const themeDots = document.querySelectorAll(".theme-dot");

themeDots.forEach((dot) => {
  dot.addEventListener("click", () => {
    const theme = THEMES[dot.dataset.theme];
    if (!theme) return;
    document.documentElement.style.setProperty("--grad-a", theme.a);
    document.documentElement.style.setProperty("--grad-b", theme.b);
    themeDots.forEach((d) => {
      d.classList.remove("is-active");
      d.setAttribute("aria-pressed", "false");
    });
    dot.classList.add("is-active");
    dot.setAttribute("aria-pressed", "true");
    showToast(`主题已切换 · ${theme.name}`);
  });
});

/* ===== 空间筛选（chip） ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const spacePills = document.querySelectorAll(".space-pill");

spacePills.forEach((pill) => {
  pill.addEventListener("click", () => {
    spacePills.forEach((p) => p.classList.remove("is-active"));
    pill.classList.add("is-active");
    const filter = pill.dataset.filter;
    feedItems.forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.space !== filter;
    });
  });
});

/* ===== 收藏 toggle ===== */
document.querySelectorAll(".feed-item__heart").forEach((heart) => {
  heart.addEventListener("click", () => {
    const on = heart.classList.toggle("is-on");
    heart.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收藏到「设计」空间" : "已取消收藏");
  });
});

/* ===== 命令栏：回车即拾取一条 ===== */
const commandInput = document.getElementById("commandInput");
const feedList = document.getElementById("feedList");

function pickFromCommand() {
  const text = (commandInput.value || "").trim();
  if (!text) {
    showToast("输入网址或标题，再按回车拾取");
    return;
  }
  const minutes = Math.floor(Math.random() * 12) + 3;
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.space = "design";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">✦</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 · 拾取</span>
    </div>
    <em class="tint-chip">${minutes} 分钟</em>
    <button class="feed-item__heart" type="button" aria-label="收藏" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20s-7.5-4.5-9.3-9.2C1.4 7.3 3.6 4.5 6.8 4.5c2 0 3.6 1.1 4.4 2.7.8-1.6 2.4-2.7 4.4-2.7 3.2 0 5.4 2.8 4.1 6.3C19.5 15.5 12 20 12 20z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = text;
  li.querySelector(".feed-item__heart").addEventListener("click", (e) => {
    const heart = e.currentTarget;
    const on = heart.classList.toggle("is-on");
    heart.setAttribute("aria-pressed", String(on));
  });
  const activeFilter = document.querySelector(".space-pill.is-active");
  const filter = activeFilter ? activeFilter.dataset.filter : "all";
  li.hidden = filter !== "all" && filter !== "design";
  feedList.prepend(li);
  commandInput.value = "";
  showToast("已拾取 · 归入「设计」空间");
}

commandInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") pickFromCommand();
});

/* ===== 开始今日稍后读 ===== */
const readNowBtn = document.getElementById("readNowBtn");

readNowBtn.addEventListener("click", () => {
  const firstVisible = feedItems.find((item) => !item.hidden) || feedList.querySelector(".feed-item:not([hidden])");
  if (firstVisible) {
    firstVisible.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  }
  showToast("从最短的一篇开始 · 3 分钟");
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "拾取") {
      commandInput.focus();
      showToast("输入网址或标题，回车拾取");
    } else if (name === "空间") {
      document.querySelector(".spaces-card").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
