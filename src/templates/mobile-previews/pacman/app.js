// 豆亭 · Pacman — 页面交互
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

/* ===== 游玩：得分上涨 ===== */
const scoreNum = document.getElementById("scoreNum");
let score = 18420;
let playing = false;

document.getElementById("playBtn").addEventListener("click", function () {
  playing = !playing;
  this.textContent = playing ? "PAUSE ‖" : "INSERT COIN ▶";
  if (playing) {
    showToast("READY!");
    this.dataset.timer = setInterval(() => {
      score += 10;
      scoreNum.textContent = score.toLocaleString("en-US");
    }, 600);
  } else {
    clearInterval(parseInt(this.dataset.timer, 10));
    showToast(`暂停 · 当前 ${score.toLocaleString("en-US")} 分`);
  }
});

/* ===== Feed 筛选 ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    feedItems.forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 模式 chip ===== */
const modeChips = document.querySelectorAll(".chips--mode .chip");
modeChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    modeChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    showToast(`模式：${chip.textContent}`);
  });
});

/* ===== 行点击：查看对手 ===== */
feedItems.forEach((item) => {
  item.addEventListener("click", () => {
    showToast(`查看对手战绩：${item.querySelector(".feed-item__name").textContent}`);
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "开玩") {
      document.getElementById("playBtn").click();
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
