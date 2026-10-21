// mobile-previews/starbucks — 星享俱乐部 · Coffee & Rewards
// 保留：状态栏时间逻辑
// 页面：菜单筛选 / 加入订单 / Tab 切换 / Toast

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

// 菜单类型筛选
const menuChips = document.querySelectorAll("#menuChips .chip");
const menuItems = document.querySelectorAll("#menuList .menu-item");
menuChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    menuChips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    menuItems.forEach((item) => {
      const show = filter === "all" || item.dataset.type === filter;
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 加入订单按钮动画
document.querySelectorAll(".add-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    // 视觉反馈：缩放
    btn.style.transform = "scale(0.8)";
    setTimeout(() => {
      btn.style.transform = "";
    }, 150);
  });
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

// 浮动按钮（FAB）点击效果
const fabBtn = document.getElementById("fabBtn");
if (fabBtn) {
  fabBtn.addEventListener("click", () => {
    fabBtn.style.transform = "scale(0.9)";
    setTimeout(() => {
      fabBtn.style.transform = "";
    }, 150);
  });
}
