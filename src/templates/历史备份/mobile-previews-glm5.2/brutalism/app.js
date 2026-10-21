// mobile-previews/brutalism — BRUTAL TRACK
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 动作完成 toggle / 组数记录 / 按钮 Toast

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
    if (tab.classList.contains("tab--fab")) {
      showToast("快速记录");
      return;
    }
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--fab")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `已切换到「${label.textContent}」` : "已切换");
  });
});

// 动作完成 toggle
document.querySelectorAll(".exercise-item__check").forEach((checkBtn) => {
  checkBtn.addEventListener("click", () => {
    const item = checkBtn.closest(".exercise-item");
    const badge = item.querySelector(".exercise-item__badge");

    if (checkBtn.classList.contains("exercise-item__check--checked")) {
      // 取消完成
      checkBtn.classList.remove("exercise-item__check--checked");
      checkBtn.setAttribute("aria-label", "标记完成");
      item.dataset.type = "todo";
      badge.textContent = "0/3";
      badge.classList.remove("exercise-item__badge--active");
      showToast("动作已恢复");
    } else {
      // 标记完成
      checkBtn.classList.remove("exercise-item__check--current");
      checkBtn.classList.add("exercise-item__check--checked");
      checkBtn.setAttribute("aria-label", "标记未完成");
      item.dataset.type = "done";
      badge.textContent = "DONE";
      showToast("动作已完成");
    }

    // 更新进度条（简单模拟）
    const progressBar = document.querySelector(".today-card__bar");
    if (progressBar) {
      const currentProgress = parseFloat(progressBar.style.getPropertyValue("--p")) || 68;
      const newProgress = checkBtn.classList.contains("exercise-item__check--checked")
        ? Math.min(currentProgress + 10, 100)
        : Math.max(currentProgress - 10, 0);
      progressBar.style.setProperty("--p", `${newProgress}%`);
    }
  });
});

// 组数记录输入框验证
const repsInput = document.getElementById("repsInput");
const weightInput = document.getElementById("weightInput");

if (repsInput && weightInput) {
  const validateInput = (input, min, max) => {
    input.addEventListener("change", () => {
      let val = parseInt(input.value);
      if (isNaN(val) || val < min) input.value = min;
      if (val > max) input.value = max;
    });
  };

  validateInput(repsInput, 1, 99);
  validateInput(weightInput, 0, 200);
}

// 模拟周统计柱状图动态
function animateWeeklyStats() {
  const bars = document.querySelectorAll(".day-col__bar");
  bars.forEach((bar, index) => {
    // 随机微调高度，模拟真实数据波动
    const currentHeight = parseFloat(bar.style.getPropertyValue("--h")) || 0;
    if (currentHeight > 0) {
      const variation = (Math.random() - 0.5) * 10;
      const newHeight = Math.max(0, Math.min(100, currentHeight + variation));
      bar.style.setProperty("--h", `${newHeight}%`);
    }
  });
}

// 每 5 秒轻微波动一次统计数据
setInterval(animateWeeklyStats, 5000);
