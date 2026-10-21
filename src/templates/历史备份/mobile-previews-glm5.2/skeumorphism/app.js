// mobile-previews/skeumorphism — 时光计 · Skeuomorphism Design System
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 记录筛选 / 计时器功能 / 按钮 Toast

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

// 底部 Tab 切换
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.classList.contains("tab--fab")) {
      showToast("快速专注");
      return;
    }
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--fab")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// 记录筛选
const chips = document.querySelectorAll("#filterChips .chip");
const recordItems = document.querySelectorAll("#recordList .record");
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    recordItems.forEach((item) => {
      const show = filter === "all" || item.dataset.type === filter;
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 计时器功能
const timerValue = document.getElementById("timerValue");
const toggleBtn = document.getElementById("toggleBtn");
const resetBtn = document.getElementById("resetBtn");
const playIcon = toggleBtn.querySelector(".play-icon");
const pauseIcon = toggleBtn.querySelector(".pause-icon");
const btnText = toggleBtn.querySelector(".btn-text");
const progressRing = document.querySelector(".timer-ring__progress");

let isRunning = false;
let timeLeft = 25 * 60; // 25 minutes in seconds
const totalTime = 25 * 60;
let timerInterval = null;

function updateDisplay() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  timerValue.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  // Update progress ring
  const circumference = 553;
  const progress = (totalTime - timeLeft) / totalTime;
  const offset = circumference * (1 - progress);
  progressRing.style.strokeDashoffset = offset;
}

toggleBtn.addEventListener("click", () => {
  if (isRunning) {
    // Pause
    clearInterval(timerInterval);
    isRunning = false;
    playIcon.style.display = "";
    pauseIcon.style.display = "none";
    btnText.textContent = "继续";
    showToast("计时已暂停");
  } else {
    // Start
    isRunning = true;
    playIcon.style.display = "none";
    pauseIcon.style.display = "";
    btnText.textContent = "暂停";
    showToast("开始专注");
    timerInterval = setInterval(() => {
      if (timeLeft > 0) {
        timeLeft--;
        updateDisplay();
      } else {
        clearInterval(timerInterval);
        isRunning = false;
        playIcon.style.display = "";
        pauseIcon.style.display = "none";
        btnText.textContent = "完成";
        showToast("专注时间结束！");
      }
    }, 1000);
  }
});

resetBtn.addEventListener("click", () => {
  clearInterval(timerInterval);
  isRunning = false;
  timeLeft = totalTime;
  updateDisplay();
  playIcon.style.display = "";
  pauseIcon.style.display = "none";
  btnText.textContent = "开始";
  showToast("计时已重置");
});

// Initialize display
updateDisplay();
