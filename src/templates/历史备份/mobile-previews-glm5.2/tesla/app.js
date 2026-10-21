// mobile-previews/tesla — Tesla Vehicle Control
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 模式筛选 / Toggle 开关 / 步进器 / Toast 反馈

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
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// 空调模式筛选
const climateChips = document.querySelectorAll("#climateChips .chip");
climateChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    climateChips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const mode = chip.dataset.mode;
    showToast(`切换到 ${mode.charAt(0).toUpperCase() + mode.slice(1)} 模式`);
  });
});

// Toggle 开关
document.querySelectorAll(".toggle").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    toggle.classList.toggle("is-on");
    const toast = toggle.dataset.toast || (toggle.classList.contains("is-on") ? "已开启" : "已关闭");
    showToast(toast);
  });
});

// 步进器
document.querySelectorAll(".stepper").forEach((stepper) => {
  const valueDisplay = stepper.querySelector(".stepper__value");
  const minusBtn = stepper.querySelector(".stepper__btn--minus");
  const plusBtn = stepper.querySelector(".stepper__btn--plus");
  let value = parseInt(valueDisplay.textContent, 10);

  minusBtn.addEventListener("click", () => {
    if (value > 0) {
      value--;
      valueDisplay.textContent = value;
      showToast(`降低至 ${value}`);
    }
  });

  plusBtn.addEventListener("click", () => {
    if (value < 3) {
      value++;
      valueDisplay.textContent = value;
      showToast(`提高至 ${value}`);
    }
  });
});
