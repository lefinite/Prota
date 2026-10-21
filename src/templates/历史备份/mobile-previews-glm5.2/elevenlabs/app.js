// mobile-previews/elevenlabs — WaveCast · ElevenLabs
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 播客筛选 / 按钮 Toast / 播放控制

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

// 底部 Tab 切换（仅本 Demo 的视觉高亮）
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.classList.contains("tab--fab")) return; // FAB 走 toast
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--fab")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `Switched to ${label.textContent}` : "Switched");
  });
});

// 播客筛选
const chips = document.querySelectorAll("#filterChips .chip");
const showCards = document.querySelectorAll("#showsGrid .show-card");
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    showCards.forEach((card) => {
      const show = filter === "all" || card.dataset.category === filter;
      card.classList.toggle("is-hidden", !show);
    });
  });
});

// 播放控制（模拟）
const mainPlayBtn = document.querySelector(".playback-btn--main");
if (mainPlayBtn) {
  let isPlaying = true;
  mainPlayBtn.addEventListener("click", () => {
    isPlaying = !isPlaying;
    mainPlayBtn.innerHTML = isPlaying
      ? '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3" /></svg>';
    mainPlayBtn.setAttribute("data-toast", isPlaying ? "已暂停" : "正在播放");
    showToast(isPlaying ? "已暂停" : "正在播放");

    // 切换波形动画
    const waveformBars = document.querySelectorAll(".waveform__bar");
    waveformBars.forEach((bar) => {
      bar.style.animationPlayState = isPlaying ? "running" : "paused";
    });
  });
}

// 进度条模拟增长
const progressBar = document.querySelector(".progress-bar__fill");
if (progressBar) {
  let progress = 28;
  setInterval(() => {
    progress += 0.1;
    if (progress > 100) progress = 0;
    progressBar.style.setProperty("--progress", `${progress}%`);
  }, 1000);
}
