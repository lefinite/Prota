// 玄响 · Sleek — 页面交互
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

/* ===== 播放状态：唱片旋转 + 均衡器 + 进度推进 ===== */
const nowSection = document.querySelector(".now");
const playBtn = document.getElementById("playBtn");
const trackFill = document.getElementById("trackFill");
const elapsedEl = document.getElementById("elapsed");

const TRACK_TOTAL = 4 * 60 + 12; // 4:12
let elapsed = 1 * 60 + 47; // 1:47
let playing = true;
let playTick = null;

function fmt(sec) {
  sec = Math.max(0, Math.round(sec));
  return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
}

function paintProgress() {
  elapsedEl.textContent = fmt(elapsed);
  trackFill.style.setProperty("--w", Math.min(elapsed / TRACK_TOTAL, 1) * 100 + "%");
}

function setPlaying(on, quiet) {
  playing = on;
  nowSection.classList.toggle("is-playing", on);
  playBtn.setAttribute("aria-pressed", String(on));
  if (playTick) {
    clearInterval(playTick);
    playTick = null;
  }
  if (on) {
    playTick = setInterval(() => {
      elapsed += 1;
      if (elapsed >= TRACK_TOTAL) {
        elapsed = 0;
        showToast("「北纬四十度的雨」播放完毕 · 自动接电台");
      }
      paintProgress();
    }, 1000);
  }
  if (!quiet) showToast(on ? "继续播放 · 唱片转动起来" : "已暂停 · 唱片停在原地");
}

playBtn.addEventListener("click", () => setPlaying(!playing));
document.getElementById("resumeBtn").addEventListener("click", () => setPlaying(true));

paintProgress();
setPlaying(true, true);

/* ===== 随机夜曲：随机高亮一首 ===== */
const feedItems = () => Array.from(document.querySelectorAll(".feed-item"));

document.getElementById("shuffleBtn").addEventListener("click", () => {
  const items = feedItems();
  const pick = items[Math.floor(Math.random() * items.length)];
  items.forEach((i) => {
    i.classList.remove("is-playing");
    const chip = i.querySelector(".feed-item__chip");
    if (chip.classList.contains("is-playing")) {
      chip.classList.remove("is-playing");
      chip.textContent = "待播";
      i.dataset.kind = "queue";
    }
  });
  pick.classList.add("is-playing");
  pick.dataset.kind = "playing";
  const chip = pick.querySelector(".feed-item__chip");
  chip.classList.add("is-playing");
  chip.innerHTML = '<i></i>播放中';
  const name = pick.querySelector(".feed-item__name").textContent;
  setPlaying(true, true);
  showToast(`随机夜曲 · 正在播放「${name}」`);
  pick.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

/* ===== chip 筛选 ===== */
const chips = document.querySelectorAll(".chip");

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    feedItems().forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 收藏 toggle ===== */
document.querySelectorAll(".feed-item__heart").forEach((heart) => {
  heart.addEventListener("click", () => {
    const on = heart.classList.toggle("is-on");
    heart.setAttribute("aria-pressed", String(on));
    heart.setAttribute("aria-label", on ? "取消收藏" : "收藏这首歌");
    const item = heart.closest(".feed-item");
    const name = item.querySelector(".feed-item__name").textContent;
    if (on) {
      item.dataset.kind = "fav";
      showToast(`「${name}」已加入收藏`);
    } else {
      item.dataset.kind = "queue";
      showToast(`「${name}」已移出收藏`);
    }
  });
});

/* ===== 搜索 ===== */
const searchInput = document.getElementById("searchInput");

searchInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const q = searchInput.value.trim();
  if (!q) {
    showToast("输入歌名、电台或艺术家试试");
    return;
  }
  const hit = feedItems().filter((i) =>
    i.querySelector(".feed-item__name").textContent.includes(q)
  );
  showToast(hit.length ? `找到 ${hit.length} 首「${q}」` : `没有找到「${q}」· 已为你开电台`);
  searchInput.value = "";
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "乐库") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
