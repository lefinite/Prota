// mobile-previews/gradient — VibeMusic 音乐播放器
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 收藏按钮 / 歌单操作 / 按钮 Toast

const statusTime = document.getElementById("statusTime");
function updateStatusTime() {
  if (!statusTime) return;
  const now = new Date();
  statusTime.textContent = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
updateStatusTime();
setInterval(updateStatusTime, 30000);

// Toast
const toastEl = document.getElementById("toast");
let toastTimer = null;
function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 1800);
}

// 任何带 data-toast 的元素点击反馈
document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    showToast(el.dataset.toast);
  });
});

// 底部 Tab 切换
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// 收藏按钮切换
const likeBtns = document.querySelectorAll(".like-btn");
likeBtns.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    btn.classList.toggle("is-liked");
  });
});

// 歌曲项点击播放
const trackItems = document.querySelectorAll(".track-item");
trackItems.forEach((item) => {
  item.addEventListener("click", (e) => {
    if (e.target.closest(".like-btn")) return;
    const title = item.querySelector(".track-item-title")?.textContent || "歌曲";
    showToast(`开始播放「${title}」`);
  });
});

// 歌单卡片点击
const playlistCards = document.querySelectorAll(".playlist-card");
playlistCards.forEach((card) => {
  card.addEventListener("click", () => {
    const playlist = card.dataset.playlist;
    const name = card.querySelector(".playlist-name")?.textContent || "歌单";
    showToast(`打开「${name}」`);
  });
});

// 播放按钮
const playBtn = document.querySelector(".play-btn");
if (playBtn) {
  playBtn.addEventListener("click", () => {
    showToast("播放/暂停");
  });
}
