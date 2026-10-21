// 玻璃调频 · Glassmorphism — 页面交互
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

/* ===== 播放器：黑胶旋转 + 进度推进 ===== */
const disc = document.getElementById("disc");
const playBtn = document.getElementById("playBtn");
const playIcon = document.getElementById("playIcon");
const progressFill = document.getElementById("progressFill");
const progress = document.querySelector(".progress");
const timeNow = document.getElementById("timeNow");

const PLAY_SVG = '<path d="M8 5.5v13l11-6.5-11-6.5z" />';
const PAUSE_SVG = '<path d="M7.5 5h3.4v14H7.5zM13.1 5h3.4v14h-3.4z" />';

const TOTAL_SECONDS = 227; // 3:47
let playing = true;
let elapsed = 84;          // 1:24
let tickTimer = null;

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = String(Math.floor(sec % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

function renderProgress() {
  const percent = Math.round((elapsed / TOTAL_SECONDS) * 100);
  progressFill.style.setProperty("--w", `${percent}%`);
  progress.setAttribute("aria-valuenow", String(percent));
  timeNow.textContent = formatTime(elapsed);
}

function startTicking() {
  stopTicking();
  tickTimer = setInterval(() => {
    elapsed += 1;
    if (elapsed >= TOTAL_SECONDS) {
      elapsed = 0;
      showToast("切到下一首 · 晚风便利店");
    }
    renderProgress();
  }, 1000);
}

function stopTicking() {
  clearInterval(tickTimer);
  tickTimer = null;
}

function setPlaying(on) {
  playing = on;
  playBtn.setAttribute("aria-label", on ? "暂停" : "播放");
  playIcon.innerHTML = on ? PAUSE_SVG : PLAY_SVG;
  disc.classList.toggle("is-spin", on);
  if (on) {
    startTicking();
  } else {
    stopTicking();
  }
}

playBtn.addEventListener("click", () => {
  setPlaying(!playing);
  showToast(playing ? "正在播放 · 雨窗" : "已暂停 · 雨窗");
});

/* 初始状态：播放中 */
renderProgress();
startTicking();

/* ===== 氛围混音 / 睡眠定时 chips ===== */
const mixChips = document.querySelectorAll(".mix-chip");
mixChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const on = chip.classList.toggle("is-on");
    chip.setAttribute("aria-pressed", String(on));
    showToast(on ? `已加入「${chip.textContent}」` : `已关闭「${chip.textContent}」`);
  });
});

const timerChips = document.querySelectorAll(".timer-chip");
timerChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    timerChips.forEach((c) => c.classList.remove("is-on"));
    chip.classList.add("is-on");
    showToast(`${chip.dataset.min} 分钟后淡出 · 晚安`);
  });
});

/* ===== 队列筛选 chips ===== */
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

/* ===== 收藏 toggle ===== */
document.querySelectorAll(".feed-item__heart").forEach((heart) => {
  heart.addEventListener("click", () => {
    const on = heart.classList.toggle("is-on");
    heart.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加入收藏" : "已移出收藏");
  });
});

/* ===== 生成电台：把新台写进队列顶部 ===== */
const quickInput = document.getElementById("quickInput");
const feedList = document.getElementById("feedList");

const HEART_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.6-9.3-9C1.3 8 3.4 4.5 7 4.5c2.2 0 3.9 1.3 5 3 1.1-1.7 2.8-3 5-3 3.6 0 5.7 3.5 4.3 7-1.8 4.4-9.3 9-9.3 9z" /></svg>';

function generateStation() {
  const text = (quickInput.value || "").trim() || "赶稿的深夜";
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "new";
  li.innerHTML = `
    <span class="feed-item__cover feed-item__cover--now" aria-hidden="true"></span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">为你生成 <em class="feed-item__chip">新电台</em></span>
    </div>
    <b class="feed-item__time">∞</b>
    <button class="feed-item__heart" type="button" aria-label="收藏新电台" aria-pressed="false">${HEART_SVG}</button>`;
  li.querySelector(".feed-item__name").textContent = `${text}电台`;
  li.querySelector(".feed-item__heart").addEventListener("click", (e) => {
    const heart = e.currentTarget;
    const on = heart.classList.toggle("is-on");
    heart.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加入收藏" : "已移出收藏");
  });
  feedList.prepend(li);
  quickInput.value = "";
  showToast(`「${text}电台」已生成 · 12 首待播`);
}

document.getElementById("genBtn").addEventListener("click", generateStation);
quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") generateStation();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "曲库") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "播放") {
      setPlaying(!playing);
      showToast(playing ? "正在播放 · 雨窗" : "已暂停");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
