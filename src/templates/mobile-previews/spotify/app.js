// 夜航电台 · Spotify — 页面交互
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

/* ===== 播放器状态 ===== */
const QUEUE = [
  { title: "城市灯河", artist: "凌晨三点俱乐部", duration: 236 },
  { title: "隧道尽头的便利店", artist: "南方公园乐队", duration: 252 },
  { title: "午夜列车", artist: "白噪音 · 车厢声", duration: 1800 },
  { title: "蓝调时刻", artist: "凌晨三点俱乐部", duration: 204 },
  { title: "街角快照", artist: "胶片剧团", duration: 178 }
];

const nowTitle = document.getElementById("nowTitle");
const nowArtist = document.getElementById("nowArtist");
const nowTotal = document.getElementById("nowTotal");
const nowElapsed = document.getElementById("nowElapsed");
const nowFill = document.getElementById("nowFill");
const nowTrack = document.getElementById("nowTrack");
const playIcon = document.getElementById("playIcon");
const likeBtn = document.getElementById("likeBtn");

const ICON_PLAY = '<path d="M8 5.1v13.8L19 12z" />';
const ICON_PAUSE = '<path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.4z" />';

let current = 0;
let playing = true;
let elapsed = 89;
let ticker = null;

function fmt(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function renderProgress() {
  const track = QUEUE[current];
  const pct = Math.min(100, Math.round((elapsed / track.duration) * 100));
  nowFill.style.width = `${pct}%`;
  nowTrack.setAttribute("aria-valuenow", String(pct));
  nowElapsed.textContent = fmt(elapsed);
}

function renderTrack() {
  const track = QUEUE[current];
  nowTitle.textContent = track.title;
  nowArtist.textContent = track.artist;
  nowTotal.textContent = fmt(track.duration);
  renderProgress();
  document.querySelectorAll(".feed-item").forEach((item) => {
    item.classList.toggle("is-playing", Number(item.dataset.index) === current);
  });
}

function tick() {
  const track = QUEUE[current];
  elapsed += 1;
  if (elapsed >= track.duration) {
    nextTrack(true);
    return;
  }
  renderProgress();
}

function setPlaying(on) {
  playing = on;
  playIcon.innerHTML = on ? ICON_PAUSE : ICON_PLAY;
  document.getElementById("playBtn").setAttribute("aria-label", on ? "暂停" : "播放");
  clearInterval(ticker);
  if (on) ticker = setInterval(tick, 1000);
}

function loadTrack(index, autoPlay) {
  current = (index + QUEUE.length) % QUEUE.length;
  elapsed = 0;
  renderTrack();
  setPlaying(autoPlay);
}

function nextTrack(silent) {
  loadTrack(current + 1, true);
  if (!silent) showToast(`下一首：${QUEUE[current].title}`);
}

document.getElementById("playBtn").addEventListener("click", () => {
  setPlaying(!playing);
  showToast(playing ? `正在播放 · ${QUEUE[current].title}` : "已暂停");
});

document.getElementById("nextBtn").addEventListener("click", () => nextTrack(false));
document.getElementById("prevBtn").addEventListener("click", () => {
  loadTrack(current - 1, true);
  showToast(`上一首：${QUEUE[current].title}`);
});

likeBtn.addEventListener("click", () => {
  const on = likeBtn.classList.toggle("is-on");
  likeBtn.setAttribute("aria-pressed", String(on));
  showToast(on ? `已收藏「${QUEUE[current].title}」` : "已取消收藏");
});

/* ===== 队列行：点击即切换正在播放 ===== */
document.querySelectorAll(".feed-item").forEach((item) => {
  const playRow = () => {
    const index = Number(item.dataset.index);
    if (index === current) {
      setPlaying(!playing);
      return;
    }
    loadTrack(index, true);
    showToast(`正在播放：${QUEUE[current].title}`);
  };
  item.addEventListener("click", (e) => {
    if (e.target.closest(".feed-item__like")) return;
    playRow();
  });
  item.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      playRow();
    }
  });
});

/* ===== 收藏 toggle（队列行） ===== */
document.querySelectorAll(".feed-item__like").forEach((heart) => {
  heart.addEventListener("click", (e) => {
    e.stopPropagation();
    const on = heart.classList.toggle("is-on");
    heart.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加入收藏歌单" : "已从收藏移除");
  });
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
      const match =
        filter === "all" ||
        item.dataset.kind === filter ||
        (filter === "saved" && item.querySelector(".feed-item__chip.is-saved"));
      item.hidden = !match;
    });
  });
});

/* ===== 播放队列 / 搜索 ===== */
const quickInput = document.getElementById("quickInput");

document.getElementById("queueBtn").addEventListener("click", () => {
  setPlaying(true);
  showToast(`队列共 ${QUEUE.length} 首 · 从「${QUEUE[current].title}」继续`);
});

quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const keyword = quickInput.value.trim();
    if (keyword) {
      showToast(`没有找到「${keyword}」，换个关键词试试`);
      quickInput.blur();
    }
  }
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "搜索") {
      quickInput.focus();
    } else if (name === "资料库") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

/* ===== 初始渲染（自动播放） ===== */
renderTrack();
setPlaying(true);
