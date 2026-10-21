// mobile-previews/spacious — Breathful
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 心情选择 / 按钮 Toast / 呼吸动画

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
  toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 2000);
}

// 任何带 data-toast 的按钮点击反馈
document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => showToast(el.dataset.toast));
});

// 心情卡片选择
const moodCards = document.querySelectorAll(".mood-card");
moodCards.forEach((card) => {
  card.addEventListener("click", () => {
    // 移除其他选中状态
    moodCards.forEach((c) => {
      c.style.background = "";
      c.style.borderColor = "";
    });
    // 设置当前选中
    card.style.background = "var(--surface-warm)";
    card.style.borderColor = "var(--accent)";
    // 显示 toast
    const moodMsg = card.dataset.toast;
    if (moodMsg) showToast(moodMsg);
  });
});

// 底部 Tab 切换
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.classList.contains("tab--fab")) return;
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--fab")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// 呼吸练习动画控制
const breathText = document.getElementById("breathText");
const breathStartBtn = document.querySelector(".breath-start");
const breathRing = document.querySelector(".breath-ring__fill");
let breathingInterval = null;
let isInhale = true;

function startBreathing() {
  // 停止现有动画
  if (breathingInterval) {
    clearInterval(breathingInterval);
    breathingInterval = null;
    breathRing.style.animation = "none";
    breathText.textContent = "吸气";
    return;
  }

  // 开始新的呼吸练习
  let phase = 0; // 0: 吸气, 1: 屏息, 2: 呼气
  let count = 0;

  breathingInterval = setInterval(() => {
    count++;
    if (count <= 4) {
      phase = 0;
      breathText.textContent = "吸气";
    } else if (count <= 11) {
      if (phase === 0) phase = 1;
      breathText.textContent = "屏息";
    } else if (count <= 19) {
      if (phase === 1) phase = 2;
      breathText.textContent = "呼气";
    } else {
      count = 0;
      phase = 0;
      breathText.textContent = "吸气";
    }
  }, 1000);

  breathRing.style.animation = "breath-circle 19s ease-in-out infinite";
}

if (breathStartBtn) {
  breathStartBtn.addEventListener("click", () => {
    startBreathing();
    showToast(breathingInterval ? "开始呼吸练习" : "练习已暂停");
  });
}

// 睡眠柱状图点击
const sleepBars = document.querySelectorAll(".sleep-bar");
sleepBars.forEach((bar) => {
  bar.addEventListener("click", () => {
    sleepBars.forEach((b) => b.classList.remove("is-active"));
    bar.classList.add("is-active");
    const height = bar.style.height || "0%";
    const hours = Math.round(parseInt(height) / 10);
    showToast(`睡眠 ${hours} 小时`);
  });
});
