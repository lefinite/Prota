// 灵感板 · Clay 设计系统 — 页面交互
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

/* ===== 通用：data-toast 按钮（色板复制、加色、新建画板等）===== */
document.querySelectorAll("[data-toast]").forEach((btn) => {
  btn.addEventListener("click", () => showToast(btn.dataset.toast));
});

/* ===== 采集类型 chip 筛选 ===== */
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

/* ===== 收藏 toggle（歪头爱心）===== */
document.querySelectorAll(".feed-item__heart").forEach((heart) => {
  heart.addEventListener("click", () => {
    const on = heart.classList.toggle("is-on");
    heart.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收藏进「城市野餐」" : "已取消收藏");
  });
});

/* ===== 快速采集：写进列表顶部 ===== */
const collectInput = document.getElementById("collectInput");
const feedList = document.getElementById("feedList");

function collect() {
  const text = (collectInput.value || "").trim();
  if (!text) {
    showToast("先描述一下你的念头");
    collectInput.focus();
    return;
  }
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "copy";
  li.innerHTML = `
    <span class="feed-item__glyph feed-item__glyph--ube" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 7V4h16v3M9 20h6M12 4v16" />
      </svg>
    </span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">文案 · 刚刚 <em class="feed-item__chip feed-item__chip--todo">待分类</em></span>
    </div>
    <button class="feed-item__heart" type="button" aria-label="收藏" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = text;
  li.querySelector(".feed-item__heart").addEventListener("click", (e) => {
    const heart = e.currentTarget;
    const on = heart.classList.toggle("is-on");
    heart.setAttribute("aria-pressed", String(on));
  });
  feedList.prepend(li);
  collectInput.value = "";
  showToast("已采集，记得分类");
}

document.getElementById("collectBtn").addEventListener("click", collect);
collectInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") collect();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "首页") {
      document.getElementById("appContent").scrollTo({ top: 0, behavior: "smooth" });
    } else if (name === "画板" || name === "色板") {
      document.getElementById("feedSection").scrollIntoView({ behavior: "smooth" });
    } else if (name === "采集") {
      collectInput.focus();
      showToast("粘贴链接或敲一句念头，回车采集");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
