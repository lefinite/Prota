// 电线杆 · The Verge 风格 — 页面交互
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

document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => showToast(el.dataset.toast));
});

/* ===== Feed 筛选 ===== */
const stories = Array.from(document.querySelectorAll(".story"));
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    stories.forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 话题 chip ===== */
const topicChips = document.querySelectorAll(".chips--topic .chip");
let topic = "AI";
topicChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    topicChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    topic = chip.textContent;
    const btn = document.getElementById("followBtn");
    btn.textContent = btn.textContent.includes("✓")
      ? `✓ 已关注 ${topic} 版面`
      : `＋ 关注 ${topic} 版面`;
  });
});

/* ===== 关注 toggle ===== */
const followBtn = document.getElementById("followBtn");

followBtn.addEventListener("click", () => {
  if (followBtn.textContent.includes("＋")) {
    followBtn.textContent = `✓ 已关注 ${topic} 版面`;
    showToast(`${topic} 版面已置顶到你的时间线`);
  } else {
    followBtn.textContent = `＋ 关注 ${topic} 版面`;
    showToast("已取消关注");
  }
});

/* ===== 搜索 ===== */
const searchInput = document.getElementById("searchInput");
searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim();
  stories.forEach((item) => {
    item.hidden = q && !item.textContent.includes(q);
  });
});

/* ===== 行点击阅读 ===== */
stories.forEach((story) => {
  story.addEventListener("click", () => {
    showToast(`阅读：${story.querySelector("h3").textContent.slice(0, 14)}…`);
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "听新闻") {
      showToast("早报音频版 · 7 分 42 秒，正在播放");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
