// 绒音 Softwave · Neumorphism — 页面交互
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

/* ===== 音量旋钮：+/- 调节 + 圆环进度 ===== */
const RING_LEN = 326.7; // 2πr, r=52
const dialFill = document.getElementById("dialFill");
const volNum = document.getElementById("volNum");
const dial = document.getElementById("dial");
let volume = 68;

function renderVolume() {
  volNum.textContent = volume;
  dialFill.style.strokeDashoffset = String(RING_LEN * (1 - volume / 100));
}

document.getElementById("volUp").addEventListener("click", () => {
  if (volume >= 100) {
    showToast("已经最大了，再大要吵醒邻居啦");
    return;
  }
  volume = Math.min(100, volume + 8);
  renderVolume();
  if (volume === 100) showToast("音量已满格");
});

document.getElementById("volDown").addEventListener("click", () => {
  if (volume <= 0) {
    showToast("已经是静音了");
    return;
  }
  volume = Math.max(0, volume - 8);
  renderVolume();
  if (volume === 0) showToast("已静音，只留一点星光");
});

renderVolume();

/* ===== 播放 / 暂停（旋钮呼吸态联动）===== */
const playBtn = document.getElementById("playBtn");
const sleepBtn = document.getElementById("sleepBtn");
let playing = true;

function setPlaying(next, silent) {
  playing = next;
  playBtn.classList.toggle("is-paused", !playing);
  playBtn.setAttribute("aria-pressed", String(playing));
  playBtn.setAttribute("aria-label", playing ? "暂停播放" : "继续播放");
  dial.classList.toggle("is-playing", playing);
  if (!silent) showToast(playing ? "继续播放 · 细雨敲窗" : "已暂停，绒音还在原地等你");
}

playBtn.addEventListener("click", () => setPlaying(!playing));
sleepBtn.addEventListener("click", () => {
  setPlaying(true, true);
  showToast("已开始入睡模式，30 分钟后渐弱");
});

/* ===== 定时 chips（单选）===== */
const timerChips = document.querySelectorAll(".duo-card .chips .chip");
const timerLabel = document.getElementById("timerLabel");
const timerText = { "15": "15 分钟后自动停止", "30": "30 分钟后自动停止", "60": "60 分钟后自动停止", "0": "整晚循环，明早见" };

timerChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    timerChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    timerLabel.textContent = timerText[chip.dataset.min];
    showToast(timerText[chip.dataset.min]);
  });
});

/* ===== 柔光唤醒 switch ===== */
const wakeSwitch = document.querySelector(".switch");

wakeSwitch.addEventListener("click", () => {
  const on = wakeSwitch.getAttribute("aria-checked") === "true";
  wakeSwitch.setAttribute("aria-checked", String(!on));
  showToast(on ? "已关闭明早柔光唤醒" : "明早 7:20 柔光唤醒已就绪");
});

/* ===== 场景筛选 chips ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const filterChips = document.querySelectorAll(".chips--filter .chip");

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

/* ===== 收藏场景 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    const item = star.closest(".feed-item");
    star.setAttribute("aria-pressed", String(on));
    if (on) {
      item.dataset.kind = "fav";
    } else if (item.dataset.kind === "fav") {
      item.dataset.kind = "sleep";
    }
    showToast(on ? `「${item.querySelector(".feed-item__name").textContent}」已加入最爱` : "已移出最爱");
  });
});

/* ===== 给今晚起个名字 ===== */
const quickInput = document.getElementById("quickInput");

quickInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const text = quickInput.value.trim();
  if (!text) {
    showToast("写下今晚的心情，一个词就好");
    return;
  }
  document.querySelector(".hero-card__scene").textContent = text;
  quickInput.value = "";
  showToast(`今晚就叫「${text}」`);
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "场景") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "混合") {
      showToast("混合台：把雨声和篝火叠在一起");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
