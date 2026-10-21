// mobile-previews/fantasy — 幻境探险 · Fantasy RPG
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 按钮 Toast

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
      showToast("进入战斗模式");
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

// 技能卡片点击反馈
document.querySelectorAll(".skill-card").forEach((card) => {
  card.addEventListener("click", () => {
    const skillName = card.querySelector(".skill-card__name").textContent;
    const skillLevel = card.querySelector(".skill-card__level").textContent;
    showToast(`${skillName} ${skillLevel} — 点击升级`);
  });
});

// 任务卡片点击
document.querySelectorAll(".quest").forEach((quest) => {
  quest.addEventListener("click", () => {
    const title = quest.querySelector(".quest__title").textContent;
    showToast(`查看任务：${title.substring(0, 8)}...`);
  });
});

// 背包物品点击
document.querySelectorAll(".inv-item").forEach((item) => {
  item.addEventListener("click", () => {
    showToast("查看物品详情");
  });
});
