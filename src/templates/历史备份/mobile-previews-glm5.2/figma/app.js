// mobile-previews/figma — DesignFlow · Figma
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 项目筛选 / 按钮 Toast

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
    showToast(label ? `${label.textContent}` : "已切换");
  });
});

// 项目类型标签筛选
const tabPills = document.querySelectorAll(".tab-pills .tab-pill");
const fileCards = document.querySelectorAll(".file-card");
tabPills.forEach((pill) => {
  pill.addEventListener("click", () => {
    tabPills.forEach((p) => {
      p.classList.remove("is-active");
      p.setAttribute("aria-selected", "false");
    });
    pill.classList.add("is-active");
    pill.setAttribute("aria-selected", "true");
    const tabType = pill.dataset.tab;

    // 简单模拟筛选效果
    fileCards.forEach((card, index) => {
      if (tabType === "recent") {
        card.style.display = "flex";
      } else if (tabType === "shared") {
        // 显示前两个
        card.style.display = index < 2 ? "flex" : "none";
      } else if (tabType === "starred") {
        // 只显示第一个
        card.style.display = index === 0 ? "flex" : "none";
      }
    });
    showToast(`View: ${pill.textContent}`);
  });
});

// 文件卡片点击反馈
document.querySelectorAll(".file-card").forEach((card) => {
  card.addEventListener("click", (e) => {
    if (e.target.closest(".file-action")) return; // 避免与选项按钮冲突
    const title = card.querySelector(".file-title").textContent;
    showToast(`Open: ${title}`);
  });
});

// 添加成员按钮
const addAvatar = document.querySelector(".avatar--add");
if (addAvatar) {
  addAvatar.addEventListener("click", () => {
    showToast("Invite team member");
  });
}
