// mobile-previews/spotify — 音悦 App · Dark Music Streaming
// 保留：状态栏时间逻辑
// 页面：播放切换 / 歌单筛选 / 喜欢 toggle / Toast

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
  toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 1600);
}

// 任何带 data-toast 的按钮点击反馈
document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => showToast(el.dataset.toast));
});

// 播放按钮切换
const playBtn = document.getElementById("playBtn");
if (playBtn) {
  playBtn.addEventListener("click", () => {
    const isPlaying = playBtn.dataset.play === "true";
    const playIcon = playBtn.querySelector(".play-icon");
    const pauseIcon = playBtn.querySelector(".pause-icon");

    if (isPlaying) {
      playBtn.dataset.play = "false";
      playIcon.style.display = "";
      pauseIcon.style.display = "none";
      showToast("已暂停");
    } else {
      playBtn.dataset.play = "true";
      playIcon.style.display = "none";
      pauseIcon.style.display = "";
      showToast("正在播放");
    }
  });
}

// 喜欢 toggle
document.querySelectorAll(".track-item__like").forEach((btn) => {
  btn.addEventListener("click", () => {
    const isActive = btn.classList.contains("track-item__like--active");
    const svg = btn.querySelector("svg");

    if (isActive) {
      btn.classList.remove("track-item__like--active");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      showToast("已取消喜欢");
    } else {
      btn.classList.add("track-item__like--active");
      svg.setAttribute("fill", "currentColor");
      svg.setAttribute("stroke", "currentColor");
      showToast("已添加到喜欢");
    }
  });
});

// 音乐类型筛选
const genreChips = document.querySelectorAll("#genreChips .chip");
const trackItems = document.querySelectorAll("#trackList .track-item");
genreChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    genreChips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    trackItems.forEach((item) => {
      const show = filter === "all" || item.dataset.genre === filter;
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 底部 Tab 切换
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.classList.contains("tab--library")) return;
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--library")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});
