// 回声 Echo · Loom — 页面交互
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

/* ===== Hero：播放 → 进度推进到 100% ===== */
const playBtn = document.getElementById("playBtn");
const heroFill = document.getElementById("heroFill");
const heroPct = document.getElementById("heroPct");
let heroWatched = 48;

playBtn.addEventListener("click", () => {
  if (heroWatched >= 100) {
    showToast("这条已看完，去收件箱看下一条");
    return;
  }
  heroWatched = 100;
  heroFill.style.setProperty("--w", "100%");
  heroPct.textContent = "已看完";
  showToast("播放完成 · 已标记为已看");
});

/* ===== chip 筛选 ===== */
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

/* ===== 搜索：实时过滤收件箱 ===== */
const searchInput = document.getElementById("searchInput");

searchInput.addEventListener("input", () => {
  const keyword = searchInput.value.trim().toLowerCase();
  feedItems.forEach((item) => {
    const text = item.textContent.toLowerCase();
    item.hidden = keyword !== "" && !text.includes(keyword);
  });
});

/* ===== 收藏 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收藏到素材库" : "已取消收藏");
  });
});

/* ===== 录制：切换录制态 ===== */
const recordBtn = document.getElementById("recordBtn");
const recordLabel = document.getElementById("recordLabel");
let recording = false;

recordBtn.addEventListener("click", () => {
  recording = !recording;
  recordBtn.classList.toggle("is-rec", recording);
  recordLabel.textContent = recording ? "结束并发送" : "录制新视频";
  showToast(recording ? "录制中… 说点什么吧" : "已发送到产品小组");
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "录制") {
      recordBtn.click();
    } else if (name === "草稿") {
      const draft = feedItems.find((i) => i.dataset.kind === "draft");
      if (draft) draft.scrollIntoView({ behavior: "smooth", block: "center" });
      showToast("1 个草稿待发送");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
